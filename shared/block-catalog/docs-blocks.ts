import { DEFAULT_DOCS_LAYOUT_CONTENT } from "../blocks/docs-layout-model.js";
import { structured } from "./content.js";
import type { WrittenBlockEntry } from "./types.js";

/** The docs layout: sidebar of pages, the page's content, and "On this page", around its children. */
export const DOCS_BLOCKS: WrittenBlockEntry[] = [
	{
		name: "core/docs-layout",
		label: "Docs layout",
		description: "Sidebar of pages, breadcrumbs, previous and next links, and an on-this-page list around your content",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_DOCS_LAYOUT_CONTENT),
		defaultStyles: { width: "100%", boxSizing: "border-box", margin: "0" },
	},
];
