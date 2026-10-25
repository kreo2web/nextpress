import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import { parsePageOther } from "@shared/page-other";
import type { Deps } from "../../routes/shared/deps";
import { SITE_PAGE_LIMIT } from "./page-paths";

type PageModels = Pick<Deps["models"], "pages">;

type Cached = { fingerprint: string; rows: DocsPage[] };

/** One cache per model layer: each app, and each test, gets its own. */
const caches = new WeakMap<PageModels["pages"], Map<string, Cached>>();
const loading = new WeakMap<PageModels["pages"], Map<string, Promise<Cached>>>();

const cacheOf = <T>(store: WeakMap<PageModels["pages"], Map<string, T>>, models: PageModels): Map<string, T> => {
	const existing = store.get(models.pages);
	if (existing) return existing;
	const created = new Map<string, T>();
	store.set(models.pages, created);
	return created;
};

/**
 * How a site's pages look right now, cheaply: how many there are and which changed last. Saving,
 * publishing, reordering, moving or deleting a page changes it (every update stamps `updatedAt`).
 * Drafts count too: renaming a draft parent changes the address of its published children.
 */
export const readSitePagesFingerprint = async ({ models, siteId }: { models: PageModels; siteId: string }): Promise<string> => {
	const filters = [{ where: "siteId", equals: siteId }];
	const [count, latest] = await Promise.all([
		models.pages.count({ where: filters }),
		models.pages.findManyWhere(filters, { limit: 1, orderBy: { property: "updatedAt", order: "descending" } }),
	]);
	const last = latest[0];
	const stamp = last?.updatedAt ? new Date(last.updatedAt).getTime() : 0;
	return `${count}:${stamp}:${last?.version ?? 0}:${last?.id ?? ""}`;
};

const loadRows = async ({ models, siteId }: { models: PageModels; siteId: string }): Promise<DocsPage[]> => {
	const rows = await models.pages.findManyWhere([{ where: "siteId", equals: siteId }], { limit: SITE_PAGE_LIMIT });
	return rows.map((row) => {
		const docs = parsePageOther(row.other).docs;
		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			parentId: row.parentId,
			menuOrder: row.menuOrder,
			status: row.status,
			password: row.password,
			...(docs?.group ? { group: true } : {}),
			...(docs?.hidden ? { hidden: true } : {}),
		};
	});
};

/**
 * Every page of a site with only what a sidebar or an address needs (never the blocks), kept in
 * memory and reloaded when the site's pages change. A docs page asks on every view, so a visit
 * costs two small queries instead of reading every page on the site. Two visits arriving while it
 * reloads share one load.
 */
export const readSitePageTree = async ({ models, siteId }: { models: PageModels; siteId: string }): Promise<DocsPage[]> => {
	const fingerprint = await readSitePagesFingerprint({ models, siteId });
	const cache = cacheOf(caches, models);
	const cached = cache.get(siteId);
	if (cached?.fingerprint === fingerprint) return cached.rows;

	const pending = cacheOf(loading, models);
	const key = `${siteId}:${fingerprint}`;
	const load = pending.get(key) ?? loadRows({ models, siteId }).then((rows) => ({ fingerprint, rows }));
	pending.set(key, load);
	try {
		const loaded = await load;
		cache.set(siteId, loaded);
		return loaded.rows;
	} finally {
		pending.delete(key);
	}
};
