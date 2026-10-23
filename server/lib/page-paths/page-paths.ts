import { buildPagePaths, normalizePagePath, resolvePagePath, type PagePathInput } from "@shared/page-paths";
import type { Deps } from "../../routes/shared/deps";

type PageModels = Pick<Deps["models"], "pages">;

/** Enough for any real site. The model's default of 50 would silently cut a big docs site short. */
export const SITE_PAGE_LIMIT = 5000;
const MAX_CHAIN = 12;

/**
 * The address of every page on a site (drafts included, so a draft parent still shows in its
 * child's address). One query. Used where a whole list of links is made: search, llms.txt.
 */
export const loadSitePagePaths = async ({ models, siteId }: { models: PageModels; siteId: string }): Promise<Map<string, string>> => {
	const rows = await models.pages.findManyWhere([{ where: "siteId", equals: siteId }], { limit: SITE_PAGE_LIMIT });
	return buildPagePaths(rows.map((row) => ({ id: row.id, slug: row.slug, parentId: row.parentId })));
};

/** The page, then its parent, then that parent's parent... Stops at a missing page, another site or a loop. */
const loadPageChain = async <T extends PagePathInput & { siteId?: string | null }>({ models, page }: { models: PageModels; page: T }): Promise<PagePathInput[]> => {
	const chain: PagePathInput[] = [page];
	const seen = new Set([page.id]);
	let parentId = page.parentId ?? null;
	while (parentId && chain.length < MAX_CHAIN && !seen.has(parentId)) {
		const parent = await models.pages.findById(parentId);
		if (!parent || (page.siteId && parent.siteId !== page.siteId)) break;
		seen.add(parent.id);
		chain.push({ id: parent.id, slug: parent.slug, parentId: parent.parentId });
		parentId = parent.parentId ?? null;
	}
	return chain;
};

/**
 * The address a page lives at, without the leading slash. A top-level page costs no query; a
 * nested one reads only its own parents, never the whole site.
 */
export const pathOfPage = async <T extends PagePathInput & { siteId?: string | null }>({ models, page }: { models: PageModels; page: T }): Promise<string> => {
	if (!page.parentId) return page.slug;
	const chain = await loadPageChain({ models, page });
	return buildPagePaths(chain).get(page.id) ?? page.slug;
};

/**
 * The page at an address on this site, or null. Slugs are unique per site, so the last word finds
 * one candidate; its parents are then read to prove the rest of the address. A single word also
 * finds a nested page (old links keep working); the caller uses `path` for the real address.
 */
export const findPageByPath = async ({ models, siteId, path }: { models: PageModels; siteId: string; path: string }) => {
	const wanted = normalizePagePath(path);
	const last = wanted.split("/").pop() ?? "";
	if (!last) return null;
	const candidate = await models.pages.findBySiteAndSlug(siteId, last);
	if (!candidate) return null;
	const chain = await loadPageChain({ models, page: candidate });
	const found = resolvePagePath({ pages: chain, path: wanted });
	if (!found || found.id !== candidate.id) return null;
	return { page: candidate, path: buildPagePaths(chain).get(candidate.id) ?? candidate.slug };
};
