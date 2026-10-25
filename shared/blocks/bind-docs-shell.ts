import { extractPageText } from "../content-text/index.js";
import { buildPagePaths } from "../page-paths.js";
import { readBlockContentData } from "../read-block-content.js";
import type { BlockConfig } from "../schema-types.js";
import type { JsonObject } from "./docs-types.js";
import { DOCS_PAGE_BLOCK_NAME, type DocsPageBound } from "./docs-page-model.js";
import {
	DEFAULT_DOCS_FEATURES,
	DOCS_SHELL_BLOCK_NAME,
	readDocsShellContent,
	resolveDocsShellSettings,
	type DocsFeatures,
	type DocsShellBound,
	type DocsShellContent,
	type DocsShellSource,
} from "./docs-shell-model.js";
import type { DocsBound } from "./docs-layout-model.js";
import { buildDocsBound, findTopAncestorId, pickTocHeadings, type DocsPage } from "./docs-layout-tree.js";

type BindParams = {
	blocks: BlockConfig[];
	/** Every page of the site (drafts too). */
	pages: DocsPage[];
	currentPageId: string;
	/** The current page's search description, shown under the title. */
	description?: string;
	/** The docs shell found on the root page, when this page inherits from it. Null: none. */
	rootShell: DocsShellContent | null;
};

type Walk = BindParams & { rootPageId: string; features: DocsFeatures };

const withData = (block: BlockConfig, extra: JsonObject): BlockConfig => ({
	...block,
	content: { kind: "structured", data: { ...readBlockContentData(block.content), ...extra } },
});

/** The page whose shell this page inherits from, as the settings panel and the sidebar header name it. */
export function describeRootPage({ pages, currentPageId }: { pages: DocsPage[]; currentPageId: string }): { id: string; title: string; path: string } | null {
	const rootId = findTopAncestorId({ pages, pageId: currentPageId });
	const root = pages.find((page) => page.id === rootId);
	if (!root || root.id === currentPageId) return null;
	const path = buildPagePaths(pages).get(root.id) ?? root.slug;
	return { id: root.id, title: root.title?.trim() || "Untitled", path: `/${path}` };
}

type ShellBoundParams = { own: DocsShellContent; pages: DocsPage[]; currentPageId: string; rootShell: DocsShellContent | null };

/**
 * What a docs shell draws: the settings in force (its own or the root page's), where they came
 * from, the sidebar tree and the brand. Used by the server and by the editor canvas alike.
 *
 * WHY the docs-wide switches are applied here and not in the view: this one function feeds the
 * published page and the editor canvas, so a switch that is off removes the same part in both.
 * With the sidebar off the tree is empty, which the view already draws as "no sidebar column".
 */
export function buildDocsShellBound({ own, pages, currentPageId, rootShell }: ShellBoundParams): DocsShellBound {
	const root = describeRootPage({ pages, currentPageId });
	const inherits = own.inherit && Boolean(rootShell) && Boolean(root);
	const settings = inherits ? resolveDocsShellSettings({ own, rootShell }) : own;
	const source: DocsShellSource = inherits && root ? { kind: "root", pageId: root.id, title: root.title, path: root.path } : { kind: "own" };
	const docs = buildDocsBound({ pages, currentPageId, rootPageId: settings.rootPageId });
	const top = docs.tree[0];
	const tree = settings.features.sidebar ? docs.tree : [];
	return { settings, source, tree, brandTitle: settings.title.trim() || top?.title || "", brandPath: top?.path ?? null };
}

/**
 * A docs page's data with the docs-wide switches taken out: a part that is off leaves nothing for
 * the view to draw (no headings, no previous/next, no markdown copy). The page's own toggles are
 * read by the view, so a part shows only when both the docs and the page have it on.
 */
export const applyDocsFeatures = ({ docs, features }: { docs: DocsBound; features: DocsFeatures }): DocsBound => ({
	...docs,
	headings: features.toc ? docs.headings : [],
	prev: features.prevNext ? docs.prev : null,
	next: features.prevNext ? docs.next : null,
	markdownPath: features.copyPage ? docs.markdownPath : "",
});

type PageBoundParams = {
	children: BlockConfig[];
	pages: DocsPage[];
	currentPageId: string;
	rootPageId: string;
	description: string;
	/** The docs-wide switches; all on when the page sits outside a docs shell. */
	features?: DocsFeatures;
};

/** What a docs page draws: the shared page data, the page's own title and its description. */
export function buildDocsPageBound({ children, pages, currentPageId, rootPageId, description, features = DEFAULT_DOCS_FEATURES }: PageBoundParams): DocsPageBound {
	const headings = pickTocHeadings(extractPageText(children).headings);
	const docs = applyDocsFeatures({ docs: buildDocsBound({ pages, currentPageId, rootPageId, headings }), features });
	const current = pages.find((page) => page.id === currentPageId);
	return { docs, title: current?.title?.trim() || "Untitled", description };
}

const bindShell = (block: BlockConfig, walk: Walk): { block: BlockConfig; rootPageId: string; features: DocsFeatures } => {
	const bound = buildDocsShellBound({ own: readDocsShellContent(block.content), pages: walk.pages, currentPageId: walk.currentPageId, rootShell: walk.rootShell });
	return { block: withData(block, { docsShell: bound }), rootPageId: bound.settings.rootPageId, features: bound.settings.features };
};

const bindPage = (block: BlockConfig, walk: Walk): BlockConfig => {
	const bound = buildDocsPageBound({
		children: block.children ?? [],
		pages: walk.pages,
		currentPageId: walk.currentPageId,
		rootPageId: walk.rootPageId,
		description: walk.description ?? "",
		features: walk.features,
	});
	return withData(block, { docs: bound.docs, pageTitle: bound.title, pageDescription: bound.description });
};

const bindNode = (block: BlockConfig, walk: Walk): BlockConfig => {
	const shell = block.name === DOCS_SHELL_BLOCK_NAME ? bindShell(block, walk) : null;
	const inner: Walk = shell ? { ...walk, rootPageId: shell.rootPageId, features: shell.features } : walk;
	const children = Array.isArray(block.children) ? block.children.map((child) => bindNode(child, inner)) : block.children;
	const base = shell ? shell.block : block;
	const next = children === block.children ? base : { ...base, children };
	return next.name === DOCS_PAGE_BLOCK_NAME ? bindPage(next, inner) : next;
};

/**
 * Fills every docs shell and docs page in a tree for rendering only (never saved: it would go
 * stale the moment another page is renamed). The server and the editor both call this, so they
 * draw the same sidebar, contents list and previous/next.
 */
export function bindDocsShellBlocks(params: BindParams): BlockConfig[] {
	return params.blocks.map((block) => bindNode(block, { ...params, rootPageId: "", features: DEFAULT_DOCS_FEATURES }));
}
