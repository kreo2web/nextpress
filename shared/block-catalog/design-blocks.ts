import { DEFAULT_BADGE_CONTENT } from "../blocks/badge-model.js";
import { CARD_BLOCK_NAME, DEFAULT_CARD_CONTENT } from "../blocks/card-model.js";
import { DEFAULT_GRID_CONTENT } from "../blocks/grid-model.js";
import { DEFAULT_LOGO_CLOUD_CONTENT } from "../blocks/logo-cloud-model.js";
import { DEFAULT_STEP_CONTENT, DEFAULT_STEPS_CONTENT, STEP_BLOCK_NAME } from "../blocks/steps-model.js";
import { DEFAULT_TAB_CONTENT, DEFAULT_TABS_CONTENT, TAB_BLOCK_NAME } from "../blocks/tabs-model.js";
import type { BlockConfig } from "../schema-types.js";
import { newBlockOther, structured } from "./content.js";
import type { StartingChildrenParams, WrittenBlockEntry } from "./types.js";

/** Shared look of a container's own box: a block's box, never padding pushed in from outside. */
const CONTAINER_STYLES = { width: "100%", boxSizing: "border-box", margin: "0" } as const;
/** A card's own padding and corners, the same whether it is inserted alone or starts inside a grid. */
const CARD_STYLES = { ...CONTAINER_STYLES, padding: "1.5rem", borderRadius: "12px", gap: "0.5rem" } as const;

type TextChild = { parentId: string; id: string; value: string };

/** A heading as it sits inside a card or step: no outer padding, the container spaces its children. */
const headingChild = ({ parentId, id, value }: TextChild): BlockConfig => ({
	id,
	name: "core/heading",
	label: "Heading",
	type: "block",
	parentId,
	category: "basic",
	content: { kind: "text", value, level: 3 },
	styles: { margin: "0", fontSize: "1.25rem", fontWeight: "600" },
	settings: {},
	other: newBlockOther(),
});

const paragraphChild = ({ parentId, id, value }: TextChild): BlockConfig => ({
	id,
	name: "core/paragraph",
	label: "Paragraph",
	type: "block",
	parentId,
	category: "basic",
	content: { kind: "text", value },
	styles: { margin: "0", fontSize: "16px", lineHeight: "1.6" },
	settings: {},
	other: newBlockOther(),
});

type ContainerChild = {
	parentId: string;
	newId: () => string;
	name: string;
	label: string;
	data: Record<string, unknown>;
	styles?: Record<string, string>;
	children: (id: string) => BlockConfig[];
};

const containerChild = ({ parentId, newId, name, label, data, styles = CONTAINER_STYLES, children }: ContainerChild): BlockConfig => {
	const id = newId();
	return {
		id,
		name,
		label,
		type: "container",
		parentId,
		category: "layout",
		content: structured(data),
		styles: { ...styles },
		settings: {},
		other: newBlockOther(),
		children: children(id),
	};
};

const startingCardChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => [
	headingChild({ parentId, id: newId(), value: "Card title" }),
	paragraphChild({ parentId, id: newId(), value: "One or two lines about it." }),
];

const card = ({ parentId, newId, title }: StartingChildrenParams & { title: string }): BlockConfig =>
	containerChild({
		parentId,
		newId,
		name: CARD_BLOCK_NAME,
		label: "Card",
		data: DEFAULT_CARD_CONTENT,
		styles: CARD_STYLES,
		children: (id) => [
			headingChild({ parentId: id, id: newId(), value: title }),
			paragraphChild({ parentId: id, id: newId(), value: "One or two lines about it." }),
		],
	});

const startingGridChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] =>
	["First feature", "Second feature", "Third feature"].map((title) => card({ parentId, newId, title }));

const step = ({ parentId, newId, title }: StartingChildrenParams & { title: string }): BlockConfig =>
	containerChild({
		parentId,
		newId,
		name: STEP_BLOCK_NAME,
		label: "Step",
		data: { ...DEFAULT_STEP_CONTENT, title },
		children: (id) => [paragraphChild({ parentId: id, id: newId(), value: "Explain what to do in this step." })],
	});

const startingSteps = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] =>
	["First step", "Second step", "Third step"].map((title) => step({ parentId, newId, title }));

const startingStepChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => [
	paragraphChild({ parentId, id: newId(), value: "Explain what to do in this step." }),
];

const tab = ({ parentId, newId, title }: StartingChildrenParams & { title: string }): BlockConfig =>
	containerChild({
		parentId,
		newId,
		name: TAB_BLOCK_NAME,
		label: "Tab",
		data: { ...DEFAULT_TAB_CONTENT, title },
		children: (id) => [paragraphChild({ parentId: id, id: newId(), value: `What shows under "${title}".` })],
	});

const startingTabs = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] =>
	["First tab", "Second tab"].map((title) => tab({ parentId, newId, title }));

const startingTabChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => [
	paragraphChild({ parentId, id: newId(), value: "What shows under this tab." }),
];

/**
 * Blocks for building common sections (Phase 2 of the docs plan): a responsive grid, cards,
 * badges, steps, tabs and a logo row. Their content shapes live in `shared/blocks/*-model.ts`.
 */
export const DESIGN_BLOCKS: WrittenBlockEntry[] = [
	{
		name: "core/grid",
		label: "Grid",
		description: "Equal items side by side that wrap: cards, features, team",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_GRID_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES, gap: "1.5rem" },
		defaultChildren: startingGridChildren,
	},
	{
		name: "core/card",
		label: "Card",
		description: "A box for a feature, plan or link, with anything inside",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_CARD_CONTENT),
		defaultStyles: { ...CARD_STYLES },
		defaultChildren: startingCardChildren,
	},
	{
		name: "core/badge",
		label: "Badge",
		description: "A small label above a heading, or a status",
		category: "basic",
		kind: "block",
		defaultContent: () => structured(DEFAULT_BADGE_CONTENT),
		defaultStyles: { margin: "0" },
	},
	{
		name: "core/steps",
		label: "Steps",
		description: "Numbered steps down the page or in a row",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_STEPS_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES },
		defaultChildren: startingSteps,
	},
	{
		name: "core/step",
		label: "Step",
		description: "One step inside Steps",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_STEP_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES },
		defaultChildren: startingStepChildren,
		placement: { parents: ["core/steps"] },
	},
	{
		name: "core/tabs",
		label: "Tabs",
		description: "Content that switches when a tab is chosen",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_TABS_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES },
		defaultChildren: startingTabs,
	},
	{
		name: "core/tab",
		label: "Tab",
		description: "One tab inside Tabs",
		category: "layout",
		kind: "container",
		defaultContent: () => structured(DEFAULT_TAB_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES },
		defaultChildren: startingTabChildren,
		placement: { parents: ["core/tabs"] },
	},
	{
		name: "core/logo-cloud",
		label: "Logo cloud",
		description: "Logos of customers or partners in a row or grid",
		category: "media",
		kind: "block",
		defaultContent: () => structured(DEFAULT_LOGO_CLOUD_CONTENT),
		defaultStyles: { ...CONTAINER_STYLES },
	},
];
