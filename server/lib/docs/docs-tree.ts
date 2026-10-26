import { readDocsSettings } from "@shared/docs/docs-page-frame";
import type { DocsSummary, DocsTree, DocsTreeItem } from "@shared/docs";
import { descendantsOf, docsFlagsOf, pageBlocks, pathOf, type DocsPageRow, type DocsSitePages } from "./docs-site-pages";

/** One row of the navigation tree, with every page under it. */
export function toDocsTreeItem({ site, row, isHome = false }: { site: DocsSitePages; row: DocsPageRow; isHome?: boolean }): DocsTreeItem {
	const flags = docsFlagsOf(row);
	return {
		id: row.id,
		title: String(row.title),
		slug: row.slug,
		path: pathOf({ site, row }),
		parentId: isHome ? null : (row.parentId ?? null),
		menuOrder: row.menuOrder ?? 0,
		status: row.status ?? "draft",
		kind: flags.group ? "group" : "page",
		hidden: flags.hidden === true,
		...(isHome && flags.ownAddress ? { ownAddress: true } : {}),
		children: (site.childrenOf.get(row.id) ?? []).map((child) => toDocsTreeItem({ site, row: child })),
	};
}

export const buildDocsTree = ({ site, home }: { site: DocsSitePages; home: DocsPageRow }): DocsTree => ({
	home: toDocsTreeItem({ site, row: home, isHome: true }),
	settings: readDocsSettings(pageBlocks(home)),
});

export function summarizeDocs({ site, home }: { site: DocsSitePages; home: DocsPageRow }): DocsSummary {
	const settings = readDocsSettings(pageBlocks(home));
	return {
		homeId: home.id,
		siteId: String(home.siteId),
		name: settings.title.trim() || String(home.title),
		path: pathOf({ site, row: home }),
		pageCount: 1 + descendantsOf({ site, pageId: home.id }).length,
		searchOn: settings.search.show,
		status: home.status ?? "draft",
	};
}
