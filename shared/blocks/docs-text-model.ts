import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const DOCS_TEXT_BLOCK_NAME = "docs/text";

/**
 * One paragraph in a docs page. `text` is inline markdown (`**bold**`, `*italic*`, `` `code` ``,
 * `[label](url)`), so it is the same words in the editor, in MDX and on the page.
 */
export type DocsTextContent = { text: string };

export const DEFAULT_DOCS_TEXT_CONTENT: DocsTextContent = { text: "Write a paragraph. Use **bold**, *italic*, `code` and [links](https://example.com)." };

export function readDocsTextContent(content: BlockContent | undefined): DocsTextContent {
	return { text: readText(readStructuredData(content).text) };
}
