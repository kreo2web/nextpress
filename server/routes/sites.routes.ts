import { Router } from "express";
import { z } from "zod";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { safeTryAsync } from "../utils";
import { resolveAccessibleSites } from "./shared/resolve-accessible-sites";
import { readErrorStatus, statusError } from "./shared/resolve-request-site";
import { changeSiteAddress, checkSiteAddress, refreshWebServer } from "../lib/site-address";
import { isAdminOfAnySite, isSiteAdmin } from "../lib/site-admin-access";
import { deleteEmptySite } from "../lib/delete-site";
import { readSiteAddress } from "../utils/site-address";
import { isSystemDefaultTheme } from "@shared/theme-display";
import type { Site } from "@shared/schema-types";

const createSiteSchema = z.object({
	name: z.string().trim().min(1).max(200),
	siteUrl: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
});

const updateSiteSchema = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	siteUrl: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	isDefault: z.boolean().optional(),
});

const toSiteListItem = (site: Site) => ({
	id: site.id,
	name: site.name ?? null,
	siteUrl: readSiteAddress(site) || null,
	isDefault: site.isDefault ?? false,
});

/**
 * Multi-site list + CRUD routes. Adding, editing and deleting sites changes what the web server
 * serves, so each needs a site admin, not just a signed-in account.
 */
export function createSitesRoutes(deps: Deps): Router {
	const router = Router();
	const { models, requireAuth, authService } = deps;

	const assertSiteAdmin = async ({ userId, siteId }: { userId: string; siteId: string }): Promise<Site> => {
		const site = await models.sites.findById(siteId);
		if (!site) throw statusError({ message: "Site not found", statusCode: 404 });
		if (!(await isSiteAdmin({ models, userId, siteId }))) {
			throw statusError({ message: "Only this site's admins can change it.", statusCode: 403 });
		}
		return site;
	};

	const findBuiltInThemeId = async (): Promise<string | null> => {
		const themes = await models.themes.findMany();
		return themes.find((theme) => isSystemDefaultTheme(theme))?.id ?? null;
	};

	router.get(
		"/",
		requireAuth,
		asyncHandler(async (req, res) => {
			const userId = authService.getCurrentUserId(req);
			if (!userId) return res.status(401).json({ message: "Unauthorized" });

			const { err, result } = await safeTryAsync(async () => {
				const sites = await resolveAccessibleSites({ models, userId });
				return { sites, total: sites.length };
			});

			if (err || !result) {
				console.error({ atFunction: "listSites", data: { userId, error: err }, message: "Error listing sites" });
				return res.status(500).json({ message: "Failed to list sites" });
			}

			res.json(result);
		}),
	);

	router.post(
		"/",
		requireAuth,
		asyncHandler(async (req, res) => {
			const userId = authService.getCurrentUserId(req);
			if (!userId) return res.status(401).json({ message: "Unauthorized" });

			const parsed = createSiteSchema.safeParse(req.body ?? {});
			if (!parsed.success) {
				return res.status(400).json({ message: "Give the site a name.", errors: parsed.error.errors });
			}

			const { err, result } = await safeTryAsync(async () => {
				if (!(await isAdminOfAnySite({ models, userId }))) {
					throw statusError({ message: "Only site admins can add sites.", statusCode: 403 });
				}

				const sites = await models.sites.findMany();
				const checked = await checkSiteAddress({ sites, input: parsed.data.siteUrl ?? null });
				if (!checked.ok) throw statusError({ message: checked.message, statusCode: checked.statusCode });

				const description = parsed.data.description?.trim() || null;
				const site = await models.sites.create({
					name: parsed.data.name,
					siteUrl: checked.address,
					description,
					ownerId: userId,
					isDefault: false,
					// A new site starts like a fresh install: its own name and address in Settings, the built-in theme.
					activeThemeId: await findBuiltInThemeId(),
					settings: {
						general: {
							siteName: parsed.data.name,
							siteUrl: checked.address ?? "",
							...(description ? { siteDescription: description } : {}),
						},
					},
				});

				const adminRole = await models.roles.findByName("admin");
				if (adminRole) {
					await models.userRoles.assignRole(userId, adminRole.id, site.id);
				}

				const notice = checked.address
					? await refreshWebServer({ models, siteId: site.id, address: checked.address })
					: null;

				return { site: toSiteListItem(site), notice };
			});

			if (err || !result) {
				const status = readErrorStatus(err);
				if (status >= 500) {
					console.error({ atFunction: "createSite", data: { userId, error: err }, message: "Error creating site" });
				}
				return res.status(status).json({ message: status >= 500 ? "Could not create the site. Try again." : err?.message });
			}

			res.status(201).json(result);
		}),
	);

	router.get(
		"/:id",
		requireAuth,
		asyncHandler(async (req, res) => {
			const userId = authService.getCurrentUserId(req);
			if (!userId) return res.status(401).json({ message: "Unauthorized" });

			const { err, result } = await safeTryAsync(async () => {
				const accessible = await resolveAccessibleSites({ models, userId });
				if (!accessible.some((site) => site.id === req.params.id)) {
					throw statusError({ message: "Site not accessible", statusCode: 403 });
				}
				const site = await models.sites.findById(req.params.id);
				if (!site) throw statusError({ message: "Site not found", statusCode: 404 });
				return { site: toSiteListItem(site) };
			});

			if (err || !result) {
				return res.status(readErrorStatus(err)).json({ message: err?.message ?? "Failed to fetch site" });
			}

			res.json(result);
		}),
	);

	router.patch(
		"/:id",
		requireAuth,
		asyncHandler(async (req, res) => {
			const userId = authService.getCurrentUserId(req);
			if (!userId) return res.status(401).json({ message: "Unauthorized" });

			const parsed = updateSiteSchema.safeParse(req.body ?? {});
			if (!parsed.success) {
				return res.status(400).json({ message: "Invalid site data", errors: parsed.error.errors });
			}

			const { err, result } = await safeTryAsync(async () => {
				const site = await assertSiteAdmin({ userId, siteId: req.params.id });

				let notice: string | null = null;
				if (parsed.data.siteUrl !== undefined) {
					const addressChange = await changeSiteAddress({
						models,
						userId,
						siteId: site.id,
						input: parsed.data.siteUrl,
					});
					if (!addressChange.ok) {
						throw statusError({ message: addressChange.message, statusCode: addressChange.statusCode });
					}
					notice = addressChange.notice;
				}

				if (parsed.data.isDefault === true && !site.isDefault) {
					const currentDefault = await models.sites.findDefaultSite();
					if (currentDefault && !(await isSiteAdmin({ models, userId, siteId: currentDefault.id }))) {
						throw statusError({ message: "Only the default site's admins can replace it.", statusCode: 403 });
					}
					const allSites = await models.sites.findMany();
					for (const other of allSites) {
						if (other.id === site.id || !other.isDefault) continue;
						await models.sites.update(other.id, { isDefault: false, updatedAt: new Date() });
					}
				}

				const updated = await models.sites.update(site.id, {
					...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
					...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
					...(parsed.data.isDefault === true ? { isDefault: true } : {}),
					updatedAt: new Date(),
				});

				return { site: toSiteListItem(updated ?? site), notice };
			});

			if (err || !result) {
				const status = readErrorStatus(err);
				if (status >= 500) {
					console.error({
						atFunction: "updateSite",
						data: { userId, siteId: req.params.id, error: err },
						message: "Error updating site",
					});
				}
				return res.status(status).json({ message: status >= 500 ? "Could not save the site. Try again." : err?.message });
			}

			res.json(result);
		}),
	);

	router.delete(
		"/:id",
		requireAuth,
		asyncHandler(async (req, res) => {
			const userId = authService.getCurrentUserId(req);
			if (!userId) return res.status(401).json({ message: "Unauthorized" });

			const { err, result } = await safeTryAsync(async () => {
				const site = await assertSiteAdmin({ userId, siteId: req.params.id });
				if (site.isDefault) {
					throw statusError({ message: "The default site can't be deleted. Make another site the default first.", statusCode: 400 });
				}

				const deleted = await deleteEmptySite({ models, siteId: site.id });
				if (!deleted.ok) throw statusError({ message: deleted.message, statusCode: deleted.statusCode });
				const notice = readSiteAddress(site)
					? await refreshWebServer({ models, siteId: site.id, address: null })
					: null;
				return { status: true, notice };
			});

			if (err || !result) {
				const status = readErrorStatus(err);
				if (status >= 500) {
					console.error({
						atFunction: "deleteSite",
						data: { userId, siteId: req.params.id, error: err },
						message: "Error deleting site",
					});
				}
				return res.status(status).json({ message: status >= 500 ? "Could not delete the site. Try again." : err?.message });
			}

			res.json(result);
		}),
	);

	return router;
}
