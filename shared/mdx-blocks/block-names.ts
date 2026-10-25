import { DOCS_HEADING_BLOCK_NAME } from "../blocks/docs-heading-model.js";
import { DOCS_LIST_BLOCK_NAME } from "../blocks/docs-list-model.js";
import { DOCS_TEXT_BLOCK_NAME } from "../blocks/docs-text-model.js";

/**
 * Which block each MDX element becomes: a `## heading`, a paragraph and a list. The one table both
 * directions read (MDX into blocks, blocks back to MDX), so they can never disagree about a name.
 */
export const MDX_ELEMENT_BLOCKS = {
	heading: DOCS_HEADING_BLOCK_NAME,
	paragraph: DOCS_TEXT_BLOCK_NAME,
	list: DOCS_LIST_BLOCK_NAME,
} as const;

/** What MDX that no docs block covers (a table, a fenced code block, `<Callout>`) is kept as, word for word. */
export const MDX_FALLBACK_BLOCK_NAME = "core/markdown";
