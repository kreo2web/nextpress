import type { Request } from "express";
import type { Site } from "@shared/schema-types";
import type { Deps } from "./deps";
import { normalizeSiteHostname } from "../../utils/validate-domain";
import { isSiteIdShape } from "./read-request-site-id";

/**
 * Resolves which site a public request belongs to.
 * Order: explicit siteId hint → Host header match on the site address (`www.` twin included) → default site.
 */
export const resolvePublicSite = async (params: {
	models: Deps["models"];
	req: Request;
	siteIdHint?: string;
}): Promise<Site | undefined> => {
	const { models, req, siteIdHint } = params;

	if (siteIdHint) {
		const hinted = await models.sites.findById(siteIdHint);
		if (hinted) return hinted;
	}

	const requestHost = normalizeSiteHostname(req.get("host") ?? "");
	if (requestHost) {
		const matched = await models.sites.findByHostname(requestHost);
		if (matched) return matched;
	}

	return models.sites.findDefaultSite();
};

/** Reads optional public site hint from query string (ignored unless it looks like a site id). */
export const readPublicSiteIdHint = (req: Request): string | undefined => {
	const raw = req.query.siteId;
	return typeof raw === "string" && isSiteIdShape(raw.trim()) ? raw.trim() : undefined;
};
