import { ACCESS_MESSAGES } from "@shared/access";
import type { Theme } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { statusError } from "../../routes/shared/status-error";
import { isAdminOfAnySite } from "../site-admin-access";
import { canOnSite, isMainSiteAdmin } from "./site-standing";

type ThemeAccessModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;

const SITES_LIMIT = 1000;

/** Making a theme is for site admins: it only shows anywhere once a site admin switches to it. */
export async function assertCanMakeTheme({ models, userId }: { models: ThemeAccessModels; userId: string }): Promise<void> {
	if (await isAdminOfAnySite({ models, userId })) return;
	console.warn({ atFunction: "access.assertCanMakeTheme", data: { userId }, message: "Refused: only site admins make themes" });
	throw statusError({ message: ACCESS_MESSAGES.notAllowed, statusCode: 403 });
}

/**
 * A theme is one shared row: changing it restyles every site that uses it. So a person may change
 * it only when they run every one of those sites. A theme no site uses yet belongs to whoever made
 * it. Main-site admins may change any theme.
 */
export async function assertCanChangeTheme({
	models,
	userId,
	theme,
}: {
	models: ThemeAccessModels;
	userId: string;
	theme: Pick<Theme, "id" | "authorId">;
}): Promise<void> {
	if (await isMainSiteAdmin({ models, userId })) return;

	const usedBy = await models.sites.findManyWhere([{ where: "activeThemeId", equals: theme.id }], { limit: SITES_LIMIT });
	const allowed =
		usedBy.length === 0
			? theme.authorId === userId
			: (await Promise.all(usedBy.map((site) => canOnSite({ models, userId, siteId: site.id, action: "manage_site" })))).every(Boolean);
	if (allowed) return;

	console.warn({
		atFunction: "access.assertCanChangeTheme",
		data: { userId, themeId: theme.id, usedBySiteIds: usedBy.map((site) => site.id) },
		message: "Refused: this theme is used by a site this person doesn't run",
	});
	throw statusError({
		message:
			usedBy.length === 0
				? ACCESS_MESSAGES.notAllowed
				: "Another site uses this theme, so you can't change it. Make a copy for your site instead.",
		statusCode: 403,
	});
}
