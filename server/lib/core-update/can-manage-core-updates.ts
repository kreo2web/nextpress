import type { Deps } from "../../routes/shared/deps";
import { isSiteAdmin } from "../site-admin-access";

type AccessModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;

/**
 * Who may see and start NextPress updates: the owner and admins of the main (default) site.
 *
 * An update restarts every site on the install, so it is an install-wide action. For a single site, or one
 * person running several, this is the same people as "admin of any site". It differs only when admin rights on
 * another site were handed to someone else (an agency's client): they should not be able to take every site
 * offline or see server paths. Changing the default site already needs this same bar (sites routes).
 * To open it to every site admin, swap the body for `isAdminOfAnySite({ models, userId })`.
 */
export async function canManageCoreUpdates({
	models,
	userId,
}: {
	models: AccessModels;
	userId: string;
}): Promise<boolean> {
	const mainSite = await models.sites.findDefaultSite();
	if (!mainSite) return false;
	return isSiteAdmin({ models, userId, siteId: mainSite.id });
}
