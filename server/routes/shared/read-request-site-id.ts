import type { Request } from "express";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Site ids are UUIDs; anything else is treated as "no site named" instead of failing in the database. */
export const isSiteIdShape = (value: string): boolean => UUID_PATTERN.test(value);

/** Reads optional `siteId` from query string or JSON body. */
export const readRequestSiteId = (req: Request): string | undefined => {
	const fromQuery = req.query.siteId;
	if (typeof fromQuery === "string" && isSiteIdShape(fromQuery.trim())) {
		return fromQuery.trim();
	}

	const fromBody = (req.body as { siteId?: string | null } | undefined)?.siteId;
	if (typeof fromBody === "string" && isSiteIdShape(fromBody.trim())) {
		return fromBody.trim();
	}

	return undefined;
};
