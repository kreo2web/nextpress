import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const DOCS_HEADING_BLOCK_NAME = "docs/heading";

/** Level 1 is the page's own title (the docs page draws it), and 5 and 6 are too small to matter in docs. */
export const DOCS_HEADING_LEVELS = [2, 3, 4] as const;
export type DocsHeadingLevel = (typeof DOCS_HEADING_LEVELS)[number];

/**
 * A section title in a docs page: `## Text` in MDX. `text` is inline markdown (code and links
 * work), the same source the paragraph block keeps.
 */
export type DocsHeadingContent = { level: DocsHeadingLevel; text: string; /** Link id typed by the author; empty means made from the text. */ anchor: string };

export const DEFAULT_DOCS_HEADING_CONTENT: DocsHeadingContent = { level: 2, text: "A new section", anchor: "" };

/** Any level an author types outside 2 to 4 is shown as a level 2 heading. */
export const readDocsHeadingLevel = (value: number | string | null | undefined): DocsHeadingLevel => {
	const number = typeof value === "string" ? Number(value) : value;
	return DOCS_HEADING_LEVELS.find((level) => level === number) ?? 2;
};

export function readDocsHeadingContent(content: BlockContent | undefined): DocsHeadingContent {
	const data = readStructuredData(content);
	return { level: readDocsHeadingLevel(typeof data.level === "number" || typeof data.level === "string" ? data.level : undefined), text: readText(data.text), anchor: readText(data.anchor) };
}
