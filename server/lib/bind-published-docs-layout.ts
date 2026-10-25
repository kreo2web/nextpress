import { documentHasBlockName } from "@shared/bind-post-blocks";
import { bindDocsLayoutBlocks } from "@shared/blocks/bind-docs-layout";
import { bindDocsShellBlocks, describeRootPage } from "@shared/blocks/bind-docs-shell";
import { DOCS_LAYOUT_BLOCK_NAME } from "@shared/blocks/docs-layout-model";
import { DOCS_SHELL_BLOCK_NAME, findDocsShell, readDocsShellContent, type DocsShellContent } from "@shared/blocks/docs-shell-model";
import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../routes/shared/deps";
import { readSitePageTree } from "./page-paths/site-page-tree";

type PageModels = Pick<Deps["models"], "pages">;

/**
 * The docs shell on the docs root page, read when this page inherits from it. Null when this
 * page is the root, or the root page has no shell yet (the page then uses its own settings).
 */
const readRootShell = async ({ models, siteId, pages, pageId }: { models: PageModels; siteId: string; pages: DocsPage[]; pageId: string }): Promise<DocsShellContent | null> => {
	const root = describeRootPage({ pages, currentPageId: pageId });
	if (!root) return null;
	const row = await models.pages.findById(root.id);
	if (!row || String(row.siteId) !== siteId || !Array.isArray(row.blocks)) return null;
	const shell = findDocsShell(row.blocks as BlockConfig[]);
	return shell ? readDocsShellContent(shell.content) : null;
};

/**
 * Fill the docs blocks' sidebar, top bar settings, breadcrumbs, previous/next and "On this page"
 * before the HTML is built, the same way post lists are filled. Only when the page has the
 * blocks; the site's page list comes from memory unless pages changed. The data lives on the
 * block for this render and is never saved.
 */
export async function bindPublishedDocsLayout({
	models,
	siteId,
	pageId,
	blocks,
	description = "",
}: {
	models: PageModels;
	siteId: string;
	pageId: string;
	blocks: BlockConfig[];
	/** This page's search description, shown under a docs page's title. */
	description?: string;
}): Promise<BlockConfig[]> {
	const hasLayout = documentHasBlockName({ blocks, name: DOCS_LAYOUT_BLOCK_NAME });
	const hasShell = documentHasBlockName({ blocks, name: DOCS_SHELL_BLOCK_NAME });
	if (!hasLayout && !hasShell) return blocks;
	const pages = await readSitePageTree({ models, siteId });
	const layoutBound = hasLayout ? bindDocsLayoutBlocks({ blocks, pages, currentPageId: pageId }) : blocks;
	if (!hasShell) return layoutBound;
	const rootShell = await readRootShell({ models, siteId, pages, pageId });
	return bindDocsShellBlocks({ blocks: layoutBound, pages, currentPageId: pageId, description, rootShell });
}
