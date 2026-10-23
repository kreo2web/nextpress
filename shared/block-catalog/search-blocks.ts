import { DEFAULT_SEARCH_CONTENT } from "../blocks/search-model.js";
import { structured } from "./content.js";
import type { WrittenBlockEntry } from "./types.js";

/** Site search (docs Phase 5): a button that opens a search window over the site's published pages. */
export const SEARCH_BLOCKS: WrittenBlockEntry[] = [
	{
		name: "core/search",
		label: "Search",
		description: "A search button that opens site search (Ctrl or ⌘ + K)",
		category: "advanced",
		kind: "block",
		defaultContent: () => structured(DEFAULT_SEARCH_CONTENT),
		defaultStyles: { margin: "0" },
	},
];
