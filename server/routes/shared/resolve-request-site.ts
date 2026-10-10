import type { Request } from "express";
import type { Site } from "@shared/schema-types";
import type { Deps } from "./deps";
import { getRequestAuthSiteId } from "../../auth";
import { readRequestSiteId } from "./read-request-site-id";
import { resolveAccessibleSites } from "./resolve-accessible-sites";

type StatusError = Error & { statusCode: number };

/** An error that carries the HTTP status a route should answer with (read back by `readErrorStatus`). */
export const statusError = ({ message, statusCode }: { message: string; statusCode: number }): StatusError =>
	Object.assign(new Error(message), { statusCode });

/** The HTTP status a failed site lookup carries, or `fallback` for any other error. */
export const readErrorStatus = (error: Error | null | undefined, fallback = 500): number => {
	const status = (error as Partial<StatusError> | null | undefined)?.statusCode;
	return typeof status === "number" ? status : fallback;
};

/**
 * The site a signed-in request acts on: the site it names (`?siteId=` or body), else the site its
 * API key belongs to. Naming no site is refused. Quietly using the default site sent changes made
 * for one site to another (settings, uploads, themes, pages made through MCP).
 */
export const resolveRequestSite = async ({
	models,
	req,
	userId,
}: {
	models: Deps["models"];
	req: Request;
	userId: string;
}): Promise<Site> => {
	const keySiteId = getRequestAuthSiteId(req);
	const siteId = readRequestSiteId(req) ?? keySiteId;
	if (!siteId) {
		throw statusError({ message: "Pick a site first.", statusCode: 400 });
	}
	if (keySiteId && keySiteId !== siteId) {
		throw statusError({ message: "This API key cannot access the requested site", statusCode: 403 });
	}

	const accessible = await resolveAccessibleSites({ models, userId });
	if (!accessible.some((site) => site.id === siteId)) {
		throw statusError({ message: "Site not accessible", statusCode: 403 });
	}

	const site = await models.sites.findById(siteId);
	if (!site) throw statusError({ message: "Site not found", statusCode: 404 });
	return site;
};
