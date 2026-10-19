import type { Site } from "@shared/schema-types";
import { isMainSiteAdmin, type AccessModels } from "./site-standing";

/** Enough for every install; the base model pages at 50 by default. */
const ALL_SITES_LIMIT = 1000;

const DASHBOARD_ROLE_NAMES = ["editor", "admin"];

/**
 * The sites this person can work on in the dashboard: sites they own, sites where they are an
 * editor or admin, and every site for a main-site admin. A subscriber role gives no site here, and
 * having no role gives nothing (before, it handed out the main site).
 */
export async function listWorkableSites({ models, userId }: { models: AccessModels; userId: string }): Promise<Site[]> {
	if (await isMainSiteAdmin({ models, userId })) {
		return models.sites.findMany({ limit: ALL_SITES_LIMIT });
	}

	const [owned, assignments, dashboardRoles] = await Promise.all([
		models.sites.findByOwner(userId),
		models.userRoles.findByUser(userId),
		models.roles.findManyWhere([{ where: "name", in: DASHBOARD_ROLE_NAMES }]),
	]);
	const dashboardRoleIds = new Set(dashboardRoles.map((role) => role.id));
	const byId = new Map(owned.map((site) => [site.id, site]));

	const roleSiteIds = [
		...new Set(
			assignments
				.filter((assignment) => dashboardRoleIds.has(assignment.roleId) && typeof assignment.siteId === "string")
				.map((assignment) => assignment.siteId as string),
		),
	].filter((siteId) => !byId.has(siteId));

	const roleSites = await Promise.all(roleSiteIds.map((siteId) => models.sites.findById(siteId)));
	roleSites.filter((site): site is Site => Boolean(site)).forEach((site) => byId.set(site.id, site));
	return [...byId.values()];
}
