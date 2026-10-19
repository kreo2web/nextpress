import { ACCESS_MESSAGES, type SiteAccess, type SiteAction } from "@shared/access";
import { statusError } from "../../routes/shared/status-error";
import { isMainSiteAdmin, readSiteAccess, type AccessModels } from "./site-standing";

/**
 * Throws a 403 (read back by `readErrorStatus`) unless this person may do `action` on this site.
 * Returns what they are there, so a route can use it without a second lookup.
 */
export async function assertCanOnSite({
	models,
	userId,
	siteId,
	action,
}: {
	models: AccessModels;
	userId: string;
	siteId: string;
	action: SiteAction;
}): Promise<SiteAccess> {
	const access = await readSiteAccess({ models, userId, siteId });
	if (access.actions.includes(action)) return access;

	console.warn({
		atFunction: "access.assertCanOnSite",
		data: { userId, siteId, action, standing: access.standing },
		message: "Refused: this person may not do this on this site",
	});
	const message = access.standing === null ? ACCESS_MESSAGES.noSite : ACCESS_MESSAGES.notAllowed;
	throw statusError({ message, statusCode: 403 });
}

/** Throws a 403 unless this person is an owner or admin of the main site. */
export async function assertMainSiteAdmin({ models, userId }: { models: AccessModels; userId: string }): Promise<void> {
	if (await isMainSiteAdmin({ models, userId })) return;
	console.warn({
		atFunction: "access.assertMainSiteAdmin",
		data: { userId },
		message: "Refused: only main-site admins may do this",
	});
	throw statusError({ message: ACCESS_MESSAGES.mainSiteOnly, statusCode: 403 });
}
