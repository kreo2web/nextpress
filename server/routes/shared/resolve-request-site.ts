import type { Request } from "express";
import { ACCESS_MESSAGES, type SiteAction } from "@shared/access";
import type { Site } from "@shared/schema-types";
import type { Deps } from "./deps";
import { getRequestAuthSiteId } from "../../auth";
import { assertCanOnSite } from "../../lib/access/assert-access";
import { readRequestSiteId } from "./read-request-site-id";
import { statusError } from "./status-error";

export { statusError, readErrorStatus } from "./status-error";

/**
 * The site a signed-in request acts on: the site it names (`?siteId=` or body), else the site its
 * API key belongs to. Naming no site is refused. Quietly using the default site sent changes made
 * for one site to another (settings, uploads, themes, pages made through MCP).
 *
 * `need` is what the request is about to do there; it defaults to working on content, which every
 * editor may. A key acts as the person who made it, so a key never does more than they can now.
 */
export const resolveRequestSite = async ({
	models,
	req,
	userId,
	need = "edit_content",
}: {
	models: Deps["models"];
	req: Request;
	userId: string;
	need?: SiteAction;
}): Promise<Site> => {
	const keySiteId = getRequestAuthSiteId(req);
	const siteId = readRequestSiteId(req) ?? keySiteId;
	if (!siteId) {
		throw statusError({ message: "Pick a site first.", statusCode: 400 });
	}
	if (keySiteId && keySiteId !== siteId) {
		throw statusError({ message: "This API key cannot access the requested site", statusCode: 403 });
	}

	const site = await models.sites.findById(siteId);
	if (!site) throw statusError({ message: ACCESS_MESSAGES.noSite, statusCode: 403 });

	await assertCanOnSite({ models, userId, siteId, action: need });
	return site;
};
