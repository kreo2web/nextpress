import { documentHasBlockName } from "@shared/bind-post-blocks";
import { bindDocsLayoutBlocks } from "@shared/blocks/bind-docs-layout";
import { DOCS_LAYOUT_BLOCK_NAME } from "@shared/blocks/docs-layout-model";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../routes/shared/deps";
import { readSitePageTree } from "./page-paths/site-page-tree";

type PageModels = Pick<Deps["models"], "pages">;

/**
 * Fill the docs layout's sidebar, breadcrumbs, previous/next and "On this page" before the HTML
 * is built, the same way post lists are filled. Only when the page has the block; the site's page
 * list comes from memory unless pages changed. The data lives on the block for this render and is
 * never saved.
 */
export async function bindPublishedDocsLayout({
	models,
	siteId,
	pageId,
	blocks,
}: {
	models: PageModels;
	siteId: string;
	pageId: string;
	blocks: BlockConfig[];
}): Promise<BlockConfig[]> {
	if (!documentHasBlockName({ blocks, name: DOCS_LAYOUT_BLOCK_NAME })) return blocks;
	const pages = await readSitePageTree({ models, siteId });
	return bindDocsLayoutBlocks({ blocks, pages, currentPageId: pageId });
}
