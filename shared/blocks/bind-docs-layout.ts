import { extractPageText } from "../content-text/index.js";
import { readBlockContentData } from "../read-block-content.js";
import type { BlockConfig } from "../schema-types.js";
import { DOCS_LAYOUT_BLOCK_NAME, readDocsLayoutContent } from "./docs-layout-model.js";
import { buildDocsBound, pickTocHeadings, type DocsPage } from "./docs-layout-tree.js";

/** The bound data for one docs layout block: its own root choice and the headings of its children. */
export function bindDocsLayoutBlock({ block, pages, currentPageId }: { block: BlockConfig; pages: DocsPage[]; currentPageId: string }): BlockConfig {
	if (block.name !== DOCS_LAYOUT_BLOCK_NAME) return block;
	const content = readDocsLayoutContent(block.content);
	const headings = pickTocHeadings(extractPageText(block.children ?? []).headings);
	const docs = buildDocsBound({ pages, currentPageId, rootPageId: content.rootPageId, headings });
	return { ...block, content: { kind: "structured", data: { ...readBlockContentData(block.content), docs } } };
}

/**
 * Fills every docs layout in a tree for rendering only. The result is never saved: it would go
 * stale the moment another page is renamed or reordered.
 */
export function bindDocsLayoutBlocks({ blocks, pages, currentPageId }: { blocks: BlockConfig[]; pages: DocsPage[]; currentPageId: string }): BlockConfig[] {
	return blocks.map((block) => {
		const children = Array.isArray(block.children) ? bindDocsLayoutBlocks({ blocks: block.children, pages, currentPageId }) : block.children;
		const next = children === block.children ? block : { ...block, children };
		return bindDocsLayoutBlock({ block: next, pages, currentPageId });
	});
}
