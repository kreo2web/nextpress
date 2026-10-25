import { buildPagePaths } from "../page-paths.js";
import type { DocsBound, DocsCrumb, DocsHeading, DocsLink, DocsNavItem } from "./docs-layout-model.js";

/** The least the sidebar needs to know about a page. */
export type DocsPage = {
	id: string;
	title?: string | null;
	slug: string;
	parentId?: string | null;
	menuOrder?: number | null;
	status?: string | null;
	password?: string | null;
	/** A label for the pages under it: never a link, even when published (`page.other.docs.group`). */
	group?: boolean;
	/** Left out of the sidebar with everything under it; still opens from its address (`page.other.docs.hidden`). */
	hidden?: boolean;
};

const MAX_DEPTH = 12;

const isOpenToVisitors = (page: DocsPage): boolean =>
	page.status === "publish" && !(typeof page.password === "string" && page.password.trim() !== "");

const titleOf = (page: DocsPage): string => page.title?.trim() || "Untitled";

const byOrderThenTitle = (a: DocsPage, b: DocsPage): number =>
	(a.menuOrder ?? 0) - (b.menuOrder ?? 0) || titleOf(a).localeCompare(titleOf(b));

/** The page, then its parent, up to the top. Stops at a missing page or a loop. */
const chainUp = ({ byId, page }: { byId: Map<string, DocsPage>; page: DocsPage }): DocsPage[] => {
	const chain = [page];
	const seen = new Set([page.id]);
	let parentId = page.parentId ?? null;
	while (parentId && chain.length < MAX_DEPTH) {
		const parent = byId.get(parentId);
		if (!parent || seen.has(parent.id)) break;
		seen.add(parent.id);
		chain.push(parent);
		parentId = parent.parentId ?? null;
	}
	return chain;
};

type BuildDocsBoundParams = {
	/** Every page of the site, drafts too (a draft parent still shapes the addresses). */
	pages: DocsPage[];
	currentPageId: string;
	/** The block's `rootPageId`; empty or unknown means the current page's top-level ancestor. */
	rootPageId?: string;
	headings?: DocsHeading[];
};

/**
 * The sidebar, breadcrumbs, previous/next and "On this page" for one page, from the site's page
 * list alone (no database), so the server and the editor draw the same thing.
 *
 * Only pages a visitor may open become links. A page they can't open stays as a plain group label
 * when pages below it are open, and is left out otherwise. The page being shown always counts as
 * open so the editor can preview a draft.
 */
export function buildDocsBound({ pages, currentPageId, rootPageId = "", headings = [] }: BuildDocsBoundParams): DocsBound {
	const byId = new Map(pages.map((page) => [page.id, page]));
	const current = byId.get(currentPageId);
	if (!current) return { tree: [], breadcrumbs: [], prev: null, next: null, headings, markdownPath: "" };

	const paths = buildPagePaths(pages);
	const pathOf = (page: DocsPage): string => `/${paths.get(page.id) ?? page.slug}`;
	const isVisible = (page: DocsPage): boolean => page.id === current.id || isOpenToVisitors(page);
	/** A page the sidebar may link to: open to the reader and not a group label. */
	const isLinkable = (page: DocsPage): boolean => isVisible(page) && page.group !== true;

	const upFromCurrent = chainUp({ byId, page: current });
	const root = byId.get(rootPageId) ?? upFromCurrent[upFromCurrent.length - 1];

	const childrenOf = new Map<string, DocsPage[]>();
	pages.forEach((page) => {
		if (!page.parentId) return;
		childrenOf.set(page.parentId, [...(childrenOf.get(page.parentId) ?? []), page]);
	});

	const buildItem = ({ page, depth, seen }: { page: DocsPage; depth: number; seen: Set<string> }): DocsNavItem | null => {
		if (page.hidden === true && depth > 0) return null;
		const nextSeen = new Set(seen).add(page.id);
		const children =
			depth >= MAX_DEPTH
				? []
				: (childrenOf.get(page.id) ?? [])
						.filter((child) => !nextSeen.has(child.id))
						.sort(byOrderThenTitle)
						.map((child) => buildItem({ page: child, depth: depth + 1, seen: nextSeen }))
						.filter((item): item is DocsNavItem => item !== null);
		const linkable = isLinkable(page);
		if (!linkable && children.length === 0) return null;
		return { id: page.id, title: titleOf(page), path: linkable ? pathOf(page) : null, isCurrent: page.id === current.id, children };
	};

	const rootItem = buildItem({ page: root, depth: 0, seen: new Set() });
	// The root heads the list as the section's first page; its pages follow at the same level.
	const tree = rootItem ? [{ ...rootItem, children: [] }, ...rootItem.children] : [];

	const order: DocsNavItem[] = [];
	const walk = (items: DocsNavItem[]): void =>
		items.forEach((item) => {
			order.push(item);
			walk(item.children);
		});
	walk(tree);
	const readable = order.filter((item): item is DocsNavItem & { path: string } => item.path !== null);
	const at = readable.findIndex((item) => item.isCurrent);
	const toLink = (item: (DocsNavItem & { path: string }) | undefined): DocsLink | null => (item ? { title: item.title, path: item.path } : null);

	const rootAt = upFromCurrent.findIndex((page) => page.id === root.id);
	const crumbPages = (rootAt >= 0 ? upFromCurrent.slice(0, rootAt + 1) : upFromCurrent).reverse();
	const breadcrumbs: DocsCrumb[] = crumbPages.map((page) => ({ title: titleOf(page), path: isLinkable(page) ? pathOf(page) : null }));

	return {
		tree,
		breadcrumbs,
		prev: at > 0 ? toLink(readable[at - 1]) : null,
		next: at >= 0 ? toLink(readable[at + 1]) : null,
		headings,
		markdownPath: `${pathOf(current)}.md`,
	};
}

type TocHeading = { id: string; text: string; depth: number };

/** The h2 and h3 headings a reader can jump to, from `extractPageText(...).headings`. */
export const pickTocHeadings = (headings: TocHeading[]): DocsHeading[] =>
	headings.flatMap((heading) =>
		(heading.depth === 2 || heading.depth === 3) && heading.id && heading.text
			? [{ id: heading.id, text: heading.text, level: heading.depth as 2 | 3 }]
			: [],
	);

/** The top-level page above `pageId` (the page itself when it has no parent): the docs root a page inherits from. */
export function findTopAncestorId({ pages, pageId }: { pages: DocsPage[]; pageId: string }): string {
	const byId = new Map(pages.map((page) => [page.id, page]));
	const start = byId.get(pageId);
	if (!start) return "";
	const chain = chainUp({ byId, page: start });
	return chain[chain.length - 1].id;
}
