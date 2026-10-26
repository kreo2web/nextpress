import type { ActiveSiteItem } from "@/hooks/useActiveSite";

/**
 * Where docs live, worked out from words people type. Pure, so setup, its preview and its checks
 * all read an address the same way. Docs are either under an address on the current site
 * (`example.com/docs`) or on a site of their own (`docs.example.com`).
 */

export type DocsPlace = "this-site" | "own-address";

/** The home page's address on a docs site of its own: addresses keep the home's address part. */
export const OWN_ADDRESS_HOME_SLUG = "docs";

const ADDRESS_PART = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const LOCAL_HOST = /^(?:[a-z0-9-]+\.)*localhost(?::\d+)?$/;

/**
 * Words NextPress itself answers at the top of a site, so a docs home there would never open.
 * Keep in step with `server/routes/shared/public-slug.ts`.
 */
const RESERVED_ADDRESS_PARTS = new Set([
	"admin",
	"api",
	"assets",
	"home",
	"page",
	"pages",
	"post",
	"posts",
	"preview",
	"renderer",
	"setup",
	"sites",
	"src",
	"uploads",
	"vendor",
]);

const LETTERS_NUMBERS_DASHES = "Use letters, numbers and dashes only, and don't start or end with a dash.";

/** The web address without its scheme or path: `https://www.example.com/x` → `example.com`. A port stays. */
export function siteBaseDomain(siteUrl: string | null | undefined): string {
	const typed = siteUrl?.trim();
	if (!typed) return "";
	const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `http://${typed}`;
	try {
		return new URL(candidate).host.replace(/^www\./, "");
	} catch {
		return "";
	}
}

/** What someone types for the address part of "On this site", as the server will read it. */
export const normalizeAddressPart = (part: string): string => part.trim().toLowerCase();

/** The message for a bad address part on this site, or null when it is fine. */
export function validateAddressPart(part: string): string | null {
	const typed = normalizeAddressPart(part);
	if (!typed) return "Type an address, like docs.";
	if (!ADDRESS_PART.test(typed)) return LETTERS_NUMBERS_DASHES;
	if (RESERVED_ADDRESS_PARTS.has(typed)) return `"${typed}" is used by NextPress itself. Try docs or help.`;
	return null;
}

/** The first part of an address of its own (`docs` in `docs.example.com`). */
export function validateSubdomain(part: string): string | null {
	const typed = normalizeAddressPart(part);
	if (!typed) return "Type the first part of the address, like docs.";
	if (!ADDRESS_PART.test(typed)) return LETTERS_NUMBERS_DASHES;
	return null;
}

/** A whole address, for sites that have no address to build on. */
export function validateFullHost(host: string): string | null {
	const typed = normalizeAddressPart(host);
	if (!typed) return "Type the full address, like docs.example.com.";
	if (!PUBLIC_HOST.test(typed) && !LOCAL_HOST.test(typed)) return "Type a full address, like docs.example.com.";
	return null;
}

export type DocsAddress = {
	/** The home page's address part. */
	slug: string;
	/** Own address: the whole address to attach to the new site. This site: the site's own address. */
	host: string;
	/** What people see: `example.com/docs` or `docs.example.com`. */
	display: string;
};

/** The address the docs will have, from what was typed and the site they are made on. */
export function buildDocsAddress({
	place,
	path,
	subdomain,
	base,
}: {
	place: DocsPlace;
	path: string;
	subdomain: string;
	base: string;
}): DocsAddress {
	if (place === "own-address") {
		const typed = normalizeAddressPart(subdomain);
		const host = base ? `${typed}.${base}` : typed;
		return { slug: OWN_ADDRESS_HOME_SLUG, host, display: host };
	}
	const slug = normalizeAddressPart(path);
	return { slug, host: base, display: `${base ? `${base}/` : "/"}${slug}` };
}

/** Another site of this install that already answers on `host`, if one does. */
export function findSiteUsingHost({
	sites,
	host,
}: {
	sites: ActiveSiteItem[];
	host: string;
}): ActiveSiteItem | undefined {
	const wanted = siteBaseDomain(host);
	if (!wanted) return undefined;
	return sites.find((site) => siteBaseDomain(site.siteUrl) === wanted);
}
