import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ACCESS_MESSAGES, SITE_ROLES } from "@shared/access";
import { INVITE_LIMITS, INVITE_MESSAGES } from "@shared/invites";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { readErrorStatus } from "./shared/status-error";
import { resolveRequestSite } from "./shared/resolve-request-site";
import { assertCanOnSite } from "../lib/access";
import type { InviteService } from "../lib/invites/invite-service";
import { resolveRequestAuth } from "../auth";
import { createRateLimiter } from "../utils/rate-limit";
import { clientAddress } from "../utils/client-address";
import { safeTryAsync } from "../utils";

const PUBLIC_LIMIT = { limit: 20, windowMs: 60_000 };
const JOIN_LIMIT = { limit: 5, windowMs: 60_000 };

const createSchema = z.object({
	siteId: z.string().uuid(),
	role: z.enum(SITE_ROLES),
	maxUses: z.number().int().min(1).max(INVITE_LIMITS.maxPlaces).nullable(),
	expiresInDays: z.number().int().min(1).max(INVITE_LIMITS.maxDays).nullable(),
	note: z.string().max(INVITE_LIMITS.noteLength).optional(),
});

const joinSchema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().email().max(320),
	username: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9_.-]+$/),
	password: z.string().min(8).max(200),
});

const codeShape = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/**
 * Invite links. Site admins list, make and cancel them for their own site. Anyone can look at an
 * open link and join through it (rate-limited per visitor). See `createInviteService` for the rules.
 */
export function createInvitesRoutes({ models, requireAuth, authService, invites }: Pick<Deps, "models" | "requireAuth" | "authService"> & { invites: InviteService }): Router {
	const router = Router();
	const checkRateLimit = createRateLimiter();

	const fail = ({ res, error, atFunction, data, fallback }: { res: Response; error: Error; atFunction: string; data: Record<string, string | null>; fallback: string }): Response => {
		const status = readErrorStatus(error);
		if (status >= 500) console.error({ atFunction, data: { ...data, error }, message: fallback });
		return res.status(status).json({ message: status >= 500 ? fallback : error.message });
	};

	const limited = ({ req, res, bucket, limit }: { req: Request; res: Response; bucket: string; limit: typeof PUBLIC_LIMIT }): boolean => {
		if (checkRateLimit({ key: `${bucket}:${clientAddress(req)}`, ...limit })) return false;
		res.status(429).json({ message: INVITE_MESSAGES.tooMany });
		return true;
	};

	router.get("/", requireAuth, asyncHandler(async (req, res) => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const { err, result } = await safeTryAsync(async () => {
			const site = await resolveRequestSite({ models, req, userId, need: "manage_people" });
			return invites.list({ siteId: site.id });
		});
		if (err || !result) return fail({ res, error: err ?? new Error("no result"), atFunction: "invites.list", data: { userId }, fallback: "Could not load invite links. Try again." });
		res.json({ invites: result });
	}));

	router.post("/", requireAuth, asyncHandler(async (req, res) => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const parsed = createSchema.safeParse(req.body ?? {});
		if (!parsed.success) return res.status(400).json({ message: INVITE_MESSAGES.invalid });

		const { err, result } = await safeTryAsync(async () => {
			await assertCanOnSite({ models, userId, siteId: parsed.data.siteId, action: "manage_people" });
			return invites.create({ userId, input: parsed.data });
		});
		if (err || !result) return fail({ res, error: err ?? new Error("no result"), atFunction: "invites.create", data: { userId, siteId: parsed.data.siteId }, fallback: "Could not make the invite link. Try again." });
		res.status(201).json(result);
	}));

	router.delete("/:id", requireAuth, asyncHandler(async (req, res) => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const inviteId = req.params.id;

		const { err, result } = await safeTryAsync(async () => {
			const siteId = await invites.siteOf(inviteId);
			if (!siteId) return null;
			await assertCanOnSite({ models, userId, siteId, action: "manage_people" });
			return invites.cancel({ siteId, inviteId });
		});
		if (err) return fail({ res, error: err, atFunction: "invites.cancel", data: { userId, inviteId }, fallback: "Could not cancel the invite link. Try again." });
		if (!result) return res.status(404).json({ message: ACCESS_MESSAGES.notFound });
		res.json(result);
	}));

	router.get("/code/:code", asyncHandler(async (req, res) => {
		if (limited({ req, res, bucket: "invite-view", limit: PUBLIC_LIMIT })) return;
		if (!codeShape.safeParse(req.params.code).success) return res.status(404).json({ message: INVITE_MESSAGES.notFound });
		const { err, result } = await safeTryAsync(() => invites.view({ code: req.params.code }));
		if (err || !result) return fail({ res, error: err ?? new Error("no result"), atFunction: "invites.view", data: { code: null }, fallback: INVITE_MESSAGES.failed });
		res.json(result);
	}));

	router.post("/code/:code/join", asyncHandler(async (req, res) => {
		if (limited({ req, res, bucket: "invite-join", limit: JOIN_LIMIT })) return;
		const code = req.params.code;
		if (!codeShape.safeParse(code).success) return res.status(404).json({ message: INVITE_MESSAGES.notFound });

		const auth = await resolveRequestAuth(req);
		const { err, result } = await safeTryAsync(async () => {
			if (auth?.method === "session") return invites.joinAsSignedIn({ code, userId: auth.userId });
			const parsed = joinSchema.safeParse(req.body ?? {});
			if (!parsed.success) throw Object.assign(new Error(INVITE_MESSAGES.invalid), { statusCode: 400 });
			return invites.joinWithNewAccount({ code, input: parsed.data });
		});
		if (err || !result) {
			return fail({ res, error: err ?? new Error("no result"), atFunction: "invites.join", data: { userId: auth?.userId ?? null, email: typeof req.body?.email === "string" ? req.body.email : null }, fallback: INVITE_MESSAGES.failed });
		}
		res.status(201).json(result);
	}));

	return router;
}
