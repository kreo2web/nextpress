import type { Deps } from "../routes/shared/deps";

type AccessModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;

const findAdminRoleIds = async (models: AccessModels): Promise<Set<string>> => {
	const roles = await models.roles.findManyWhere([{ where: "name", equals: "admin" }]);
	return new Set(roles.map((role) => role.id));
};

/**
 * True when the user owns the site or holds its admin role. Changing a site's address or deleting it
 * rewrites what the web server serves, so being merely signed in (sign-up is open) is not enough.
 */
export async function isSiteAdmin({
	models,
	userId,
	siteId,
}: {
	models: AccessModels;
	userId: string;
	siteId: string;
}): Promise<boolean> {
	const site = await models.sites.findById(siteId);
	if (!site) return false;
	if (site.ownerId === userId) return true;

	const adminRoleIds = await findAdminRoleIds(models);
	const assignments = await models.userRoles.findByUser(userId);
	return assignments.some((assignment) => assignment.siteId === siteId && adminRoleIds.has(assignment.roleId));
}

/** True when the user owns or administers at least one site: the bar for adding a new site. */
export async function isAdminOfAnySite({ models, userId }: { models: AccessModels; userId: string }): Promise<boolean> {
	const owned = await models.sites.findByOwner(userId);
	if (owned.length > 0) return true;

	const adminRoleIds = await findAdminRoleIds(models);
	const assignments = await models.userRoles.findByUser(userId);
	return assignments.some((assignment) => adminRoleIds.has(assignment.roleId));
}
