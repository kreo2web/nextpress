import type { Deps } from "../../routes/shared/deps";
import { isPubliclyReadable } from "../is-publicly-readable";
import type { BlockConfig } from "@shared/schema-types";
import { loadSitePagePaths, SITE_PAGE_LIMIT } from "../page-paths/page-paths";
import { readSitePagesFingerprint } from "../page-paths/site-page-tree";
import { buildSearchIndex, type SearchHit, type SearchIndex } from "./build-search-index";

type PageModels = Pick<Deps["models"], "pages">;

export type SiteSearch = {
	search: (params: { siteId: string; query: string; limit: number }) => Promise<SearchHit[]>;
};

type CachedIndex = { fingerprint: string; index: SearchIndex };

const publishedOfSite = (siteId: string) => [
	{ where: "siteId", equals: siteId },
	{ where: "status", equals: "publish" },
];

const buildSiteIndex = async ({ models, siteId }: { models: PageModels; siteId: string }): Promise<SearchIndex> => {
	const [rows, paths] = await Promise.all([
		models.pages.findManyWhere(publishedOfSite(siteId), { limit: SITE_PAGE_LIMIT }),
		loadSitePagePaths({ models, siteId }),
	]);
	return buildSearchIndex(
		rows
			.filter((row) => isPubliclyReadable(row))
			.map((row) => ({
				id: row.id,
				title: row.title,
				slug: row.slug,
				path: paths.get(row.id) ?? row.slug,
				blocks: (Array.isArray(row.blocks) ? row.blocks : []) as BlockConfig[],
			})),
	);
};

/**
 * Search over each site's published pages. The index for a site is kept in memory and rebuilt
 * on the next search after its pages change (see `readSitePagesFingerprint`); there is no table to keep.
 * Two searches arriving while it rebuilds share one rebuild.
 */
export const createSiteSearch = ({ models }: { models: PageModels }): SiteSearch => {
	const cache = new Map<string, CachedIndex>();
	const building = new Map<string, Promise<CachedIndex>>();

	const indexFor = async (siteId: string): Promise<SearchIndex> => {
		const fingerprint = await readSitePagesFingerprint({ models, siteId });
		const cached = cache.get(siteId);
		if (cached?.fingerprint === fingerprint) return cached.index;
		const pending = building.get(`${siteId}:${fingerprint}`) ?? buildSiteIndex({ models, siteId }).then((index) => ({ fingerprint, index }));
		building.set(`${siteId}:${fingerprint}`, pending);
		try {
			const built = await pending;
			cache.set(siteId, built);
			return built.index;
		} finally {
			building.delete(`${siteId}:${fingerprint}`);
		}
	};

	return {
		search: async ({ siteId, query, limit }) => (await indexFor(siteId)).search({ query, limit }),
	};
};
