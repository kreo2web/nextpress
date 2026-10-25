import { DEFAULT_DOCS_LAYOUT_CONTENT } from "../blocks/docs-layout-model.js";
import { DEFAULT_DOCS_PAGE_CONTENT, DOCS_PAGE_BLOCK_NAME } from "../blocks/docs-page-model.js";
import { DEFAULT_DOCS_SHELL_CONTENT, DOCS_SHELL_BLOCK_NAME } from "../blocks/docs-shell-model.js";
import type { BlockConfig } from "../schema-types.js";
import { newBlockOther, structured } from "./content.js";
import type { StartingChildrenParams, WrittenBlockEntry } from "./types.js";

const BOX_STYLES = { width: "100%", boxSizing: "border-box", margin: "0" } as const;

const startingDocsPage = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => {
	const pageId = newId();
	return [
		{
			id: pageId,
			name: DOCS_PAGE_BLOCK_NAME,
			label: "Docs page",
			type: "container",
			parentId,
			category: "docs",
			content: structured(DEFAULT_DOCS_PAGE_CONTENT),
			styles: { ...BOX_STYLES },
			settings: {},
			other: newBlockOther(),
			children: [
				{
					id: newId(),
					name: "core/paragraph",
					label: "Paragraph",
					type: "block",
					parentId: pageId,
					category: "basic",
					content: { kind: "text", value: "Start writing the page here." },
					styles: { margin: "0", fontSize: "16px", lineHeight: "1.6" },
					settings: {},
					other: newBlockOther(),
				},
			],
		},
	];
};

/**
 * The docs chrome and one docs page. `core/docs-layout` is the older single block that did both;
 * it keeps working for pages that already use it and is no longer offered in the block library.
 */
export const DOCS_BLOCKS: WrittenBlockEntry[] = [
	{
		name: DOCS_SHELL_BLOCK_NAME,
		label: "Docs shell",
		description: "The docs frame: a top bar with search and links, and a sidebar of pages. Set it up once on the docs home page",
		category: "docs",
		kind: "container",
		defaultContent: () => structured(DEFAULT_DOCS_SHELL_CONTENT),
		defaultStyles: { ...BOX_STYLES },
		defaultChildren: startingDocsPage,
		placement: { parents: ["core/page-shell"] },
	},
	{
		name: DOCS_PAGE_BLOCK_NAME,
		label: "Docs page",
		description: "One docs page: breadcrumbs, title, copy page, on-this-page list and previous and next links around your blocks",
		category: "docs",
		kind: "container",
		defaultContent: () => structured(DEFAULT_DOCS_PAGE_CONTENT),
		defaultStyles: { ...BOX_STYLES },
		placement: { parents: [DOCS_SHELL_BLOCK_NAME] },
	},
	{
		name: "core/docs-layout",
		label: "Docs layout (legacy)",
		description: "Legacy: the older all-in-one docs block. Use Docs shell and Docs page for new pages",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_DOCS_LAYOUT_CONTENT),
		defaultStyles: { width: "100%", boxSizing: "border-box", margin: "0" },
	},
];
