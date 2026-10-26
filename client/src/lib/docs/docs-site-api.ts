import { apiRequest } from "@/lib/queryClient";
import { appendSiteIdToUrl } from "@/lib/site-api";
import type { ActiveSiteItem } from "@/hooks/useActiveSite";

/**
 * The calls docs on their own address need from the sites and options routes. Docs on their own
 * address are a site with that address, so these are the same calls Sites → Add site and
 * Pages → "Set as homepage" make.
 */

/** A site write answers with the site and, when the web server needs a word, a plain note. */
export type SiteSaveResult = { site: ActiveSiteItem; notice: string | null };

const readSiteSave = async (response: Response): Promise<SiteSaveResult> => {
	const body = (await response.json()) as { site: ActiveSiteItem; notice?: string | null };
	return { site: body.site, notice: body.notice ?? null };
};

/**
 * Makes the site the docs will live on. It starts with no address on purpose: the sites route only
 * accepts an address that already points at this server, and the docs setup lets people finish
 * before their domain provider has caught up. The address is attached afterwards.
 */
export async function createDocsSite({ name }: { name: string }): Promise<SiteSaveResult> {
	const response = await apiRequest("POST", "/api/sites", { name: name.trim(), siteUrl: null, description: null });
	return readSiteSave(response);
}

/** Gives a site its address. The server refuses an address that is taken or does not point here yet. */
export async function attachSiteAddress({ siteId, host }: { siteId: string; host: string }): Promise<SiteSaveResult> {
	const response = await apiRequest("PATCH", `/api/sites/${encodeURIComponent(siteId)}`, { siteUrl: host });
	return readSiteSave(response);
}

/** The site's homepage setting: the page whose address visitors get at the site's root. */
export async function setSiteHomepage({ siteId, slug }: { siteId: string; slug: string }): Promise<void> {
	await apiRequest("POST", appendSiteIdToUrl("/api/options", siteId), { name: "homepage_page_slug", value: slug });
}
