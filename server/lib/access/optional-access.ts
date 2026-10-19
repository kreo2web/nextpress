import type { Request } from "express";
import type { Deps } from "../../routes/shared/deps";
import { resolveRequestAuth } from "../../auth";
import { canOnSite } from "./site-standing";

/**
 * For public reads that show more to the site's own team (drafts, private items): true when this
 * request comes from someone who may edit content on the site, with an API key only for that site.
 * Visitors and everyone else get false, never an error.
 */
export async function readerCanEdit({ req, models, siteId }: { req: Request; models: Deps["models"]; siteId: string }): Promise<boolean> {
	const auth = await resolveRequestAuth(req);
	if (!auth) return false;
	if (auth.siteId && auth.siteId !== siteId) return false;
	return canOnSite({ models, userId: auth.userId, siteId, action: "edit_content" });
}
