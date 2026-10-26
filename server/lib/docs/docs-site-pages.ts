import { buildPagePaths, pagePathInputOf } from "@shared/page-paths";
import { parsePageOther } from "@shared/page-other";
import type { PageDocsFlags } from "@shared/schema-types";
import { isDocsHomeBlocks } from "@shared/docs/docs-page-frame";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { SITE_PAGE_LIMIT } from "../page-paths/page-paths";

export type DocsPageRow = NonNullable<Awaited<ReturnType<Deps["models"]["pages"]["findById"]>>>;

/** A site's pages, indexed once for the walks a docs needs (parents, children, addresses). */
export type DocsSitePages = {
	rows: DocsPageRow[];
	byId: Map<string, DocsPageRow>;
	childrenOf: Map<string, DocsPageRow[]>;
	paths: Map<string, string>;
};

const blocksOf = (row: DocsPageRow): BlockConfig[] => (Array.isArray(row.blocks) ? (row.blocks as BlockConfig[]) : []);

/** Lower `menuOrder` first, then by title, the same order the sidebar uses. */
export const byMenuOrder = (a: DocsPageRow, b: DocsPageRow): number =>
	(a.menuOrder ?? 0) - (b.menuOrder ?? 0) || String(a.title).localeCompare(String(b.title));

/**
 * Every page of the site, drafts included (a draft parent still shapes its children's addresses).
 * Always with an explicit limit: the model returns 50 rows without one, silently.
 */
export async function loadDocsSitePages({ models, siteId }: { models: Deps["models"]; siteId: string }): Promise<DocsSitePages> {
	const rows = (await models.pages.findManyWhere([{ where: "siteId", equals: siteId }], { limit: SITE_PAGE_LIMIT })).filter(
		(row) => row.status !== "trash",
	);
	const byId = new Map(rows.map((row) => [row.id, row]));
	const childrenOf = new Map<string, DocsPageRow[]>();
	rows.forEach((row) => {
		if (!row.parentId || !byId.has(row.parentId)) return;
		childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row]);
	});
	childrenOf.forEach((list) => list.sort(byMenuOrder));
	const paths = buildPagePaths(rows.map(pagePathInputOf));
	return { rows, byId, childrenOf, paths };
}

export const isDocsHomeRow = (row: DocsPageRow): boolean => !row.parentId && isDocsHomeBlocks(blocksOf(row));

/** The docs home above a page (the page itself for a home), or null when the page is in no docs. */
export function docsHomeOf({ site, pageId }: { site: DocsSitePages; pageId: string }): DocsPageRow | null {
	let current = site.byId.get(pageId);
	const seen = new Set<string>();
	while (current?.parentId && !seen.has(current.id)) {
		seen.add(current.id);
		const parent = site.byId.get(current.parentId);
		if (!parent) break;
		current = parent;
	}
	return current && isDocsHomeRow(current) ? current : null;
}

/** Every page under `pageId`, parents before their children. */
export function descendantsOf({ site, pageId }: { site: DocsSitePages; pageId: string }): DocsPageRow[] {
	const found: DocsPageRow[] = [];
	const seen = new Set<string>([pageId]);
	const queue = [...(site.childrenOf.get(pageId) ?? [])];
	while (queue.length > 0) {
		const row = queue.shift();
		if (!row || seen.has(row.id)) continue;
		seen.add(row.id);
		found.push(row);
		queue.push(...(site.childrenOf.get(row.id) ?? []));
	}
	return found;
}

export const docsFlagsOf = (row: DocsPageRow): PageDocsFlags => parsePageOther(row.other).docs ?? {};

export const pathOf = ({ site, row }: { site: DocsSitePages; row: DocsPageRow }): string => `/${site.paths.get(row.id) ?? row.slug}`;

export const pageBlocks = blocksOf;
