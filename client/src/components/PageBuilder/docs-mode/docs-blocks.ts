import { DOCS_PAGE_BLOCK_NAME, readDocsPageContent as readPageFlags } from "@shared/blocks/docs-page-model";
import type { BlockConfig } from "@shared/schema-types";
import type { DocsPageToggleKey, DocsPageToggles } from "./docs-types";

/** The first block with this name anywhere in the tree. */
export function findBlockByName({ blocks, name }: { blocks: BlockConfig[]; name: string }): BlockConfig | null {
	for (const block of blocks) {
		if (block.name === name) return block;
		const inner = Array.isArray(block.children) ? findBlockByName({ blocks: block.children, name }) : null;
		if (inner) return inner;
	}
	return null;
}

/** The docs page: the column of the frame that takes blocks. */
export const findDocsPageBlock = (blocks: BlockConfig[]): BlockConfig | null => findBlockByName({ blocks, name: DOCS_PAGE_BLOCK_NAME });

/** The docs page's own switches for the parts around its text. */
export function readPageToggles(docsPage: BlockConfig | null): DocsPageToggles {
	const flags = readPageFlags(docsPage?.content);
	return { showToc: flags.showToc, showPrevNext: flags.showPrevNext, copyPage: flags.copyPage };
}

/** One switch changed, as the block update that writes it (the other switches are kept by the merge). */
export const togglePatch = ({ key, on }: { key: DocsPageToggleKey; on: boolean }): Partial<BlockConfig> => ({
	content: { kind: "structured", data: { [key]: on } },
});
