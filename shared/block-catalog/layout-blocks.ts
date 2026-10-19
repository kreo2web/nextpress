import { ACCORDION_ITEM_BLOCK_NAME, DEFAULT_ACCORDION_CONTENT, DEFAULT_ACCORDION_ITEM_CONTENT } from "../accordion-model.js";
import { DEFAULT_HEADER_CONTENT } from "../header-model.js";
import { DEFAULT_PAGE_SHELL_CONTENT } from "../page-shell-model.js";
import { DEFAULT_POPUP_CONTENT } from "../popup-model.js";
import type { BlockConfig } from "../schema-types.js";
import { DEFAULT_STACK_CONTENT } from "../stack-model.js";
import { fresh, newBlockOther, structured } from "./content.js";
import type { StartingChildrenParams, WrittenBlockEntry } from "./types.js";

export const BUTTONS_DEFAULT_DATA = {
	buttons: [
		{
			id: "btn-1",
			text: "Click Me",
			url: "#",
			linkTarget: "_self" as const,
			rel: "",
			title: "",
			className: "",
		},
	],
	layout: "flex-start" as const,
	orientation: "horizontal" as const,
	className: "",
};

export const COLUMNS_DEFAULT_CONTENT = {
	kind: "structured" as const,
	data: {
		layoutMode: "flex" as const,
		gap: "20px",
		minColumnWidth: "220px",
		verticalAlignment: "top" as const,
		horizontalAlignment: "left" as const,
		direction: "row" as const,
		columnVerticalAlignment: "top" as const,
		columnHorizontalAlignment: "stretch" as const,
	},
};

export const CONTAINER_DEFAULT_CONTENT = {
	tagName: "div",
	className: "",
};

export const GROUP_DEFAULT_CONTENT = {
	tagName: "div",
	className: "",
};

export const TEMPLATE_PART_DEFAULT_CONTENT = {
	templateId: "",
};

/**
 * A new accordion item: a title and one paragraph as its answer, ready to type into.
 * WHY here and not via the registry: the accordion's settings add items, and importing the
 * registry from a block would make the registry import itself.
 */
export const buildAccordionItem = ({
	id,
	parentId,
	title,
	newId,
}: {
	id: string;
	parentId: string;
	title: string;
	newId: () => string;
}): BlockConfig => {
	const answerId = newId();
	return {
		id,
		name: ACCORDION_ITEM_BLOCK_NAME,
		label: "Accordion item",
		type: "container",
		parentId,
		category: "layout",
		content: { kind: "structured", data: { title, open: false } },
		styles: {},
		settings: {},
		other: newBlockOther(),
		children: [
			{
				id: answerId,
				name: "core/paragraph",
				label: "Paragraph",
				type: "block",
				parentId: id,
				category: "basic",
				content: { kind: "text", value: "Write the answer here." },
				styles: { margin: "0", fontSize: "15px", lineHeight: "1.6" },
				settings: {},
				other: newBlockOther(),
			},
		],
	};
};

/** The three items a new accordion starts with. */
const startingAccordionItems = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] =>
	["First question", "Second question", "Third question"].map((title) =>
		buildAccordionItem({ id: newId(), parentId, title, newId }),
	);

/** A new popup starts with a heading and a line of text to replace. */
const startingPopupChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => [
	{
		id: newId(),
		name: "core/heading",
		label: "Heading",
		type: "block",
		parentId,
		category: "basic",
		content: { kind: "text", value: "Stay in the loop", level: 2 },
		styles: { margin: "0 0 8px", fontSize: "1.5rem", fontWeight: "600" },
		settings: {},
		other: newBlockOther(),
	},
	{
		id: newId(),
		name: "core/paragraph",
		label: "Paragraph",
		type: "block",
		parentId,
		category: "basic",
		content: { kind: "text", value: "Tell visitors what they get, then add a button or form." },
		styles: { margin: "0" },
		settings: {},
		other: newBlockOther(),
	},
];

export const LAYOUT_BLOCKS: readonly WrittenBlockEntry[] = [
	{
		name: "core/buttons",
		label: "Buttons",
		description: "A row of buttons",
		category: "basic",
		kind: "block",
		defaultContent: () => structured(BUTTONS_DEFAULT_DATA),
		defaultStyles: { margin: "1em 0" },
	},
	{
		name: "core/columns",
		label: "Columns",
		description: "Flexible horizontal container for any blocks",
		category: "layout",
		kind: "container",
		defaultContent: () => fresh(COLUMNS_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
	{
		name: "core/container",
		label: "Container",
		description: "Wrap blocks in a box with background, padding, and max width",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(CONTAINER_DEFAULT_CONTENT),
		defaultStyles: {
			padding: "24px",
			width: "100%",
			maxWidth: "100%",
			marginLeft: "auto",
			marginRight: "auto",
			backgroundColor: "#f8fafc",
			borderRadius: "8px",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: "1rem",
		},
	},
	{
		name: "core/group",
		label: "Group",
		description: "Gather blocks in a layout container",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(GROUP_DEFAULT_CONTENT),
		defaultStyles: {
			padding: "1rem 1.25rem",
			width: "100%",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: "1rem",
			alignItems: "flex-start",
			justifyContent: "flex-start",
		},
	},
	{
		name: "core/stack",
		label: "Stack",
		description: "Stack blocks vertically, in a row, or layered AB",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_STACK_CONTENT),
		defaultStyles: {
			width: "100%",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			flexWrap: "nowrap",
			alignItems: "flex-start",
			justifyContent: "flex-start",
			gap: "1rem",
			padding: "0px",
			margin: "0px",
		},
	},
	{
		name: "core/page-shell",
		label: "Page shell",
		description: "Page-wide canvas: padding, font, width, and colors",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_PAGE_SHELL_CONTENT),
		defaultStyles: {
			width: "100%",
			boxSizing: "border-box",
			padding: "0px",
			margin: "0px",
		},
		// The editor refuses a second shell and keeps the one shell at the page root (treeUtils).
		placement: { rootOnly: true },
	},
	{
		name: "core/header",
		label: "Header",
		description: "Site header with brand, links, and buttons",
		category: "layout",
		// Children only appear in the "Blocks" layout, but the header must be a container to hold them.
		kind: "container",
		defaultContent: () => structured(DEFAULT_HEADER_CONTENT),
		defaultStyles: {
			width: "100%",
			boxSizing: "border-box",
			padding: "0px",
			margin: "0px",
		},
	},
	{
		name: "core/accordion",
		label: "Accordion",
		description: "Questions or sections that open and close",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_ACCORDION_CONTENT),
		defaultStyles: { width: "100%", boxSizing: "border-box", padding: "0" },
		defaultChildren: startingAccordionItems,
	},
	{
		name: "core/accordion-item",
		label: "Accordion item",
		description: "One question or section inside an accordion",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_ACCORDION_ITEM_CONTENT),
		defaultStyles: { padding: "0", margin: "0" },
	},
	{
		name: "core/popup",
		label: "Popup",
		description: "A window over the page, opened by a button or link",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_POPUP_CONTENT),
		defaultStyles: { padding: "0", margin: "0" },
		defaultChildren: startingPopupChildren,
	},
	{
		name: "core/template-part",
		label: "Template",
		description: "Shows a template that stays linked to this page",
		category: "layout",
		kind: "block",
		defaultContent: () => structured(TEMPLATE_PART_DEFAULT_CONTENT),
		defaultStyles: {},
	},
];
