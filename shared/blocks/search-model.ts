import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const SEARCH_BLOCK_NAME = "core/search";

/** The search button: its words, and the hint shown inside the search window. */
export type SearchContent = { label: string; placeholder: string };

export const DEFAULT_SEARCH_CONTENT: SearchContent = { label: "Search", placeholder: "Search this site" };

export function readSearchContent(content: BlockContent | undefined): SearchContent {
	const data = readStructuredData(content);
	return {
		label: readText(data.label, DEFAULT_SEARCH_CONTENT.label),
		placeholder: readText(data.placeholder, DEFAULT_SEARCH_CONTENT.placeholder),
	};
}
