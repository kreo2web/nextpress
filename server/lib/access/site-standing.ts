import {
	actionsForStanding,
	isSiteRoleName,
	strongestStanding,
	type SiteAccess,
	type SiteAction,
	type SiteStanding,
} from "@shared/access";
import type { Deps } from "../../routes/shared/deps";
import { canManageCoreUpdates } from "../core-update/can-manage-core-updates";

export type AccessModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;

/**
 * What this person is on this site: its owner, the strongest role they hold there, or nothing.
 * A role name the code doesn't know (a custom row) gives no powers: unknown means no.
 */
export async function readSiteStanding({
	models,
	userId,
	siteId,
}: {
	models: AccessModels;
	userId: string;
	siteId: string;
}): Promise<SiteStanding | null> {
	const site = await models.sites.findById(siteId);
	if (!site) return null;
	if (site.ownerId === userId) return "owner";

	const roleIds = (await models.userRoles.findByUser(userId))
		.filter((assignment) => assignment.siteId === siteId)
		.map((assignment) => assignment.roleId);
	if (roleIds.length === 0) return null;

	const roles = await models.roles.findManyWhere([{ where: "id", in: roleIds }]);
	return strongestStanding(roles.map((role) => role.name).filter(isSiteRoleName));
}

/** Owner or admin of the main site: they run the install, so they can act on every site. */
export const isMainSiteAdmin = ({ models, userId }: { models: AccessModels; userId: string }): Promise<boolean> =>
	canManageCoreUpdates({ models, userId });

/** Everything the dashboard and the routes need to know about one person on one site. */
export async function readSiteAccess({
	models,
	userId,
	siteId,
}: {
	models: AccessModels;
	userId: string;
	siteId: string;
}): Promise<SiteAccess> {
	const [standing, mainSiteAdmin] = await Promise.all([
		readSiteStanding({ models, userId, siteId }),
		isMainSiteAdmin({ models, userId }),
	]);
	const actions = mainSiteAdmin ? actionsForStanding("owner") : actionsForStanding(standing);
	return { siteId, standing, actions: [...actions], isMainSiteAdmin: mainSiteAdmin };
}

export async function canOnSite({
	models,
	userId,
	siteId,
	action,
}: {
	models: AccessModels;
	userId: string;
	siteId: string;
	action: SiteAction;
}): Promise<boolean> {
	const access = await readSiteAccess({ models, userId, siteId });
	return access.actions.includes(action);
}
