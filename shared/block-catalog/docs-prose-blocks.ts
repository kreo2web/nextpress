import { DEFAULT_DOCS_HEADING_CONTENT, DOCS_HEADING_BLOCK_NAME } from "../blocks/docs-heading-model.js";
import { DEFAULT_DOCS_LIST_CONTENT, DOCS_LIST_BLOCK_NAME } from "../blocks/docs-list-model.js";
import { DEFAULT_DOCS_TEXT_CONTENT, DOCS_TEXT_BLOCK_NAME } from "../blocks/docs-text-model.js";
import { structured } from "./content.js";
import type { WrittenBlockEntry } from "./types.js";

/**
 * Spacing between prose blocks in a docs page. No padding: the page's reading column is the
 * only inset. Type sizes are not set here; each block draws with `.np-prose`.
 */
const PROSE_BOX = { width: "100%", boxSizing: "border-box", padding: "0" } as const;

/**
 * The MDX blocks of a docs page (category `docs`): each is one MDX element (`## Text`, a paragraph,
 * `- item`), so a page written in MDX and a page built from blocks are the same page.
 */
export const DOCS_PROSE_BLOCKS: WrittenBlockEntry[] = [
	{
		name: DOCS_HEADING_BLOCK_NAME,
		label: "Docs heading",
		description: "A section title (level 2 to 4) with a link to itself, listed in On this page",
		category: "docs",
		kind: "block",
		defaultContent: () => structured(DEFAULT_DOCS_HEADING_CONTENT),
		defaultStyles: { ...PROSE_BOX, margin: "28px 0 10px" },
	},
	{
		name: DOCS_TEXT_BLOCK_NAME,
		label: "Docs text",
		description: "A paragraph with bold, italic, code and links",
		category: "docs",
		kind: "block",
		defaultContent: () => structured(DEFAULT_DOCS_TEXT_CONTENT),
		defaultStyles: { ...PROSE_BOX, margin: "0 0 16px" },
	},
	{
		name: DOCS_LIST_BLOCK_NAME,
		label: "Docs list",
		description: "Bullets, numbers or a checklist, with one level of nesting",
		category: "docs",
		kind: "block",
		defaultContent: () => structured({ style: DEFAULT_DOCS_LIST_CONTENT.style, items: structuredClone(DEFAULT_DOCS_LIST_CONTENT.items) }),
		defaultStyles: { ...PROSE_BOX, margin: "0 0 16px" },
	},
];
