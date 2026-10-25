import type { BlockContent } from "../schema-types.js";
import { readStructuredData } from "./read-structured.js";

export const CODE_GROUP_BLOCK_NAME = "docs/code-group";

/**
 * Tabs of code blocks (npm / pnpm / yarn). Each child is a `core/code`; its tab label is the code's
 * title, else its language. Choosing a tab picks the same label in every group on the page with the
 * same labels, and, with `remember`, on the reader's next pages too.
 */
export type CodeGroupContent = {
	/** Keep the reader's choice (say "pnpm") for the next code group they meet on this site. */
	remember: boolean;
};

export const DEFAULT_CODE_GROUP_CONTENT: CodeGroupContent = { remember: true };

export function readCodeGroupContent(content: BlockContent | undefined): CodeGroupContent {
	return { remember: readStructuredData(content).remember !== false };
}
