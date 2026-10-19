import { Router, type Response } from "express";
import { z } from "zod";
import { ACCESS_MESSAGES, SITE_ROLES, isAtLeast, isSiteRoleName, strongestStanding, type SitePerson, type SiteStanding } from "@shared/access";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { readErrorStatus, statusError } from "./shared/status-error";
import { resolveRequestSite } from "./shared/resolve-request-site";
import { assertCanOnSite } from "../lib/access";
import { safeTryAsync } from "../utils";

const changeSchema = z.object({ siteId: z.string().uuid(), role: z.enum(SITE_ROLES) });

/**
 * Who has which role on one site. Site admins manage it for their own site. Nobody changes the
 * site's owner or their own role (no locking yourself out), and nobody raises anyone above themselves
 * or touches someone who stands above them.
 */
export function createSitePeopleRoutes({ models, requireAuth, authService }: Pick<Deps, "models" | "requireAuth" | "authService">): Router {
	const router = Router();

	const fail = ({ res, error, atFunction, data }: { res: Response; error: Error; atFunction: string; data: Record<string, string> }): Response => {
		const status = readErrorStatus(error);
		if (status >= 500) console.error({ atFunction, data: { ...data, error }, message: "People request failed" });
		return res.status(status).json({ message: status >= 500 ? "Something went wrong. Try again." : error.message });
	};

	/** Role ids by name, and each person's standing on the site (owner first, then roles). */
	const readPeople = async (siteId: string): Promise<SitePerson[]> => {
		const site = await models.sites.findById(siteId);
		const [assignments, roleRows] = await Promise.all([
			models.userRoles.findBySite(siteId),
			models.roles.findManyWhere([{ where: "name", in: [...SITE_ROLES] }]),
		]);
		const roleName = new Map(roleRows.map((role) => [role.id, role.name]));
		const standings = new Map<string, SiteStanding[]>();
		assignments.forEach((assignment) => {
			const name = roleName.get(assignment.roleId);
			if (name && isSiteRoleName(name)) standings.set(assignment.userId, [...(standings.get(assignment.userId) ?? []), name]);
		});
		if (site?.ownerId) standings.set(site.ownerId, ["owner"]);

		const people = await Promise.all(
			[...standings.entries()].map(async ([userId, list]) => {
				const user = await models.users.findById(userId);
				const standing = strongestStanding(list);
				if (!user || !standing) return null;
				return { userId, name: user.name ?? user.username, email: user.email ?? null, username: user.username, profileImageUrl: user.profileImageUrl ?? null, standing };
			}),
		);
		return people.filter((person): person is SitePerson => person !== null).sort((a, b) => a.name.localeCompare(b.name));
	};

	/** Throws unless `actorId` may change `targetId`'s role on the site (to `next`, when given). */
	const assertMayChange = async ({ actorId, targetId, siteId, next }: { actorId: string; targetId: string; siteId: string; next?: SiteStanding }): Promise<void> => {
		const actor = await assertCanOnSite({ models, userId: actorId, siteId, action: "manage_people" });
		const actorStanding: SiteStanding | null = actor.isMainSiteAdmin ? "owner" : actor.standing;
		if (targetId === actorId) throw statusError({ message: "You can't change your own role.", statusCode: 400 });

		const target = (await readPeople(siteId)).find((person) => person.userId === targetId);
		if (!target) throw statusError({ message: ACCESS_MESSAGES.notFound, statusCode: 404 });
		if (target.standing === "owner") throw statusError({ message: "The site's owner keeps full access.", statusCode: 400 });
		if (!isAtLeast({ a: actorStanding, b: target.standing }) || (next && !isAtLeast({ a: actorStanding, b: next }))) {
			throw statusError({ message: "You can't give a role above your own.", statusCode: 403 });
		}
	};

	const removeSiteRoles = async ({ userId, siteId }: { userId: string; siteId: string }): Promise<void> => {
		const roleRows = await models.roles.findManyWhere([{ where: "name", in: [...SITE_ROLES] }]);
		await Promise.all(roleRows.map((role) => models.userRoles.removeRole(userId, role.id, siteId)));
	};

	router.get("/", requireAuth, asyncHandler(async (req, res) => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const { err, result } = await safeTryAsync(async () => {
			const site = await resolveRequestSite({ models, req, userId, need: "manage_people" });
			return readPeople(site.id);
		});
		if (err || !result) return fail({ res, error: err ?? new Error("no result"), atFunction: "sitePeople.list", data: { userId } });
		res.json({ people: result });
	}));

	router.put("/:userId", requireAuth, asyncHandler(async (req, res) => {
		const actorId = authService.getCurrentUserId(req);
		if (!actorId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const parsed = changeSchema.safeParse(req.body ?? {});
		if (!parsed.success) return res.status(400).json({ message: "Pick a role." });
		const { siteId, role } = parsed.data;
		const targetId = req.params.userId;

		const { err } = await safeTryAsync(async () => {
			await assertMayChange({ actorId, targetId, siteId, next: role });
			const roleRow = await models.roles.findByName(role);
			if (!roleRow) throw new Error(`Role ${role} is missing`);
			await removeSiteRoles({ userId: targetId, siteId });
			await models.userRoles.assignRole(targetId, roleRow.id, siteId);
		});
		if (err) return fail({ res, error: err, atFunction: "sitePeople.change", data: { actorId, targetId, siteId } });
		res.json({ people: await readPeople(siteId) });
	}));

	router.delete("/:userId", requireAuth, asyncHandler(async (req, res) => {
		const actorId = authService.getCurrentUserId(req);
		if (!actorId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const siteId = typeof req.query.siteId === "string" ? req.query.siteId : "";
		if (!z.string().uuid().safeParse(siteId).success) return res.status(400).json({ message: "Pick a site first." });
		const targetId = req.params.userId;

		const { err } = await safeTryAsync(async () => {
			await assertMayChange({ actorId, targetId, siteId });
			await removeSiteRoles({ userId: targetId, siteId });
		});
		if (err) return fail({ res, error: err, atFunction: "sitePeople.remove", data: { actorId, targetId, siteId } });
		res.json({ people: await readPeople(siteId) });
	}));

	return router;
}
