import type { BlockConfig } from "../schema-types.js";
import type { MdxNode } from "../markdown/mdx-tree.js";
import { DOC_COMPONENT_PROPS } from "../markdown/doc-component-props.js";
import { fileTreeTextFromNodes } from "../markdown/file-tree-text.js";
import { readLiteralExpression } from "../markdown/safe-mdx.js";
import { safeHref } from "../markdown/safe-href.js";
import { CALLOUT_BLOCK_NAME, CALLOUT_TYPES, type CalloutType } from "../blocks/callout-model.js";
import { CODE_EXAMPLE_BLOCK_NAME, CODE_EXAMPLE_LAYOUTS } from "../blocks/code-example-model.js";
import { CODE_GROUP_BLOCK_NAME } from "../blocks/code-group-model.js";
import { FILE_TREE_BLOCK_NAME } from "../blocks/file-tree-model.js";
import { readGridContent } from "../blocks/grid-model.js";
import { stepIconFromName } from "../blocks/step-icon-view.js";
import { DEFAULT_STEP_ICON, STEPS_MARKERS } from "../blocks/steps-model.js";
import { UPDATE_BLOCK_NAME } from "../blocks/update-model.js";
import { type BlockFields, buildBlock } from "./build-block.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import { flowNodes, isJsxElement } from "./mdx-flow.js";
import { mapCodeNode } from "./map-code.js";
import type { MapContext, Mapped, Mapper } from "./map-types.js";
import { isPlainPhrase } from "./source-slice.js";

type Props = Record<string, string>;

/**
 * The props a component was written with, when each one is a plain word or a literal and the component
 * takes it. Anything else (an unknown prop, a `{name}` expression) gives null, so the tag stays as written
 * instead of losing a prop.
 */
const readStrictProps = ({ node, allowed }: { node: MdxNode; allowed: readonly string[] }): Props | null => {
	const props: Props = {};
	for (const attribute of node.attributes ?? []) {
		if (attribute.type !== "mdxJsxAttribute" || !attribute.name || !allowed.includes(attribute.name)) return null;
		const value = attribute.value;
		if (value === null || value === undefined) props[attribute.name] = "true";
		else if (typeof value === "string") props[attribute.name] = value;
		else {
			const literal = readLiteralExpression(value);
			if (literal === undefined) return null;
			props[attribute.name] = literal;
		}
	}
	return props;
};

/** True when a value is one of the allowed words. */
const isChoice = <T extends string>(options: readonly T[], value: string): value is T => (options as readonly string[]).includes(value);

const blockOf = ({ ctx, name, fields, children = [] }: { ctx: MapContext; name: string; fields?: BlockFields; children?: BlockConfig[] }): Mapped => ({
	kind: "block",
	block: buildBlock({ name, newId: ctx.newId, fields, children }),
});

/**
 * The children of a container that takes one kind of child (Tabs takes Tab): each child must be that tag and
 * map to a block. Null when any child is something else, so the whole container stays as written.
 */
const onlyChildren = ({ ctx, node, tag, map }: { ctx: MapContext; node: MdxNode; tag: string; map: Mapper }): BlockConfig[] | null => {
	const blocks: BlockConfig[] = [];
	for (const part of flowNodes(node.children ?? [])) {
		if (!isJsxElement(part) || part.name !== tag) return null;
		const mapped = map({ ctx, node: part });
		if (!mapped || mapped.kind !== "block") return null;
		blocks.push(mapped.block);
	}
	return blocks;
};

/** The words of a component's children when they are plain phrases (no tags, no blocks), as written. Null when they are anything else. */
const plainWords = ({ ctx, nodes }: { ctx: MapContext; nodes: MdxNode[] }): string | null => {
	const parts = flowNodes(nodes);
	const words = parts.length === 1 && parts[0].type === "paragraph" ? (parts[0].children ?? []) : parts;
	if (words.length === 0) return "";
	if (!words.every(isPlainPhrase)) return null;
	const start = words[0].position?.start.offset;
	const end = words[words.length - 1].position?.end.offset;
	return typeof start === "number" && typeof end === "number" ? ctx.source.slice(start, end).trim() : null;
};

/** `<Callout type title>`, and the short forms (`<Tip>`, `<Warning>`…), which are a callout of one fixed type. */
const calloutOf =
	(fixedType: CalloutType | null, allowed: readonly string[]): Mapper =>
	({ ctx, node }) => {
		const props = readStrictProps({ node, allowed });
		if (!props) return null;
		const type = fixedType ?? props.type ?? "note";
		if (!isChoice(CALLOUT_TYPES, type)) return null;
		return blockOf({ ctx, name: CALLOUT_BLOCK_NAME, fields: { type, title: props.title ?? "" }, children: ctx.mapChildren(node.children ?? []) });
	};

/** Code tabs: every child is a fenced code block (not a diagram), each one a tab. */
const mapCodeGroup: Mapper = ({ ctx, node }) => {
	if (!readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.CodeGroup })) return null;
	const fences: BlockConfig[] = [];
	for (const part of flowNodes(node.children ?? [])) {
		const block = part.type === "code" ? mapCodeNode({ ctx, node: part }) : null;
		if (!block || block.name !== CORE_BLOCK_NAMES.code) return null;
		fences.push(block);
	}
	return fences.length > 0 ? blockOf({ ctx, name: CODE_GROUP_BLOCK_NAME, fields: { remember: true }, children: fences }) : null;
};

/** A file tree: its nested list (or plain lines) becomes the block's own tree text, one line per entry. */
const mapFileTree: Mapper = ({ ctx, node }) => {
	if (!readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.FileTree })) return null;
	const parts = flowNodes(node.children ?? []);
	if (!parts.every((part) => part.type === "list" || part.type === "paragraph")) return null;
	return blockOf({ ctx, name: FILE_TREE_BLOCK_NAME, fields: { tree: fileTreeTextFromNodes(parts) } });
};

/** One parameter: its name is required; its words are the description. Joins its neighbours in one params block. */
const mapParam: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Param });
	const required = props?.required;
	if (!props?.name || (required !== undefined && required !== "true" && required !== "false")) return null;
	const description = plainWords({ ctx, nodes: node.children ?? [] });
	if (description === null) return null;
	return { kind: "param", item: { name: props.name, type: props.type ?? "", default: props.default ?? "", required: required === "true", description } };
};

/** A code example: the first child is the code, the rest is the result (the block reads it the same way). */
const mapExample: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Example });
	const layout = props?.layout ?? "side";
	if (!props || !isChoice(CODE_EXAMPLE_LAYOUTS, layout)) return null;
	return blockOf({ ctx, name: CODE_EXAMPLE_BLOCK_NAME, fields: { layout }, children: ctx.mapChildren(node.children ?? []) });
};

const mapTab: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Tab });
	if (!props?.title) return null;
	return blockOf({ ctx, name: CORE_BLOCK_NAMES.tab, fields: { title: props.title }, children: ctx.mapChildren(node.children ?? []) });
};

/** Tabs: each child is a Tab with a title; the tab bar draws underlined, with a link per tab, as the MDX tag does. */
const mapTabs: Mapper = ({ ctx, node }) => {
	if (!readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Tabs })) return null;
	const tabs = onlyChildren({ ctx, node, tag: "Tab", map: mapTab });
	return tabs && tabs.length > 0 ? blockOf({ ctx, name: CORE_BLOCK_NAMES.tabs, fields: { look: "underline", linkable: true }, children: tabs }) : null;
};

const mapStep: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Step });
	if (!props?.title) return null;
	const icon = props.icon === undefined ? { ...DEFAULT_STEP_ICON } : stepIconFromName(props.icon);
	return blockOf({ ctx, name: CORE_BLOCK_NAMES.step, fields: { title: props.title, icon }, children: ctx.mapChildren(node.children ?? []) });
};

/** Steps: vertical, with the marker the tag names (number by default). */
const mapSteps: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Steps });
	const marker = props?.marker ?? "number";
	if (!props || !isChoice(STEPS_MARKERS, marker)) return null;
	const steps = onlyChildren({ ctx, node, tag: "Step", map: mapStep });
	return steps && steps.length > 0 ? blockOf({ ctx, name: CORE_BLOCK_NAMES.steps, fields: { layout: "vertical", marker }, children: steps }) : null;
};

/** One card: its title is a field of the card, and `href` (when safe) makes the whole card a link, named by its title. */
const mapCard: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Card });
	if (!props) return null;
	const link = props.href ?? "";
	if (link !== "" && safeHref(link) !== link) return null;
	const title = props.title ?? "";
	return blockOf({ ctx, name: CORE_BLOCK_NAMES.card, fields: { title, link, linkLabel: title }, children: ctx.mapChildren(node.children ?? []) });
};

/** Cards: a grid of 1 to 4 columns (2 by default), one column on phones, the same numbers the MDX tag reads. */
const mapCards: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Cards });
	if (!props) return null;
	const columns = props.cols === undefined ? 2 : Number(props.cols);
	if (!Number.isInteger(columns) || columns < 1 || columns > 4) return null;
	const cards = onlyChildren({ ctx, node, tag: "Card", map: mapCard });
	if (!cards || cards.length === 0) return null;
	return blockOf({ ctx, name: CORE_BLOCK_NAMES.grid, fields: { ...readGridContent({ kind: "structured", data: { columns, phoneColumns: 1 } }) }, children: cards });
};

/** One `<Accordion title>`: an item. Consecutive items are grouped into one accordion by the converter. */
const mapAccordion: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Accordion });
	if (!props?.title) return null;
	const item = buildBlock({ name: CORE_BLOCK_NAMES.accordionItem, newId: ctx.newId, fields: { title: props.title, open: false }, children: ctx.mapChildren(node.children ?? []) });
	return { kind: "accordion", item };
};

const mapUpdate: Mapper = ({ ctx, node }) => {
	const props = readStrictProps({ node, allowed: DOC_COMPONENT_PROPS.Update });
	if (!props) return null;
	return blockOf({ ctx, name: UPDATE_BLOCK_NAME, fields: { label: props.label ?? "", description: props.description ?? "" }, children: ctx.mapChildren(node.children ?? []) });
};

/**
 * The tags the converter turns into blocks. `Tab`, `Step` and `Card` are not here on purpose: they only
 * mean something inside their container, so on their own they stay as written.
 */
const COMPONENT_MAPPERS = new Map<string, Mapper>([
	["Callout", calloutOf(null, DOC_COMPONENT_PROPS.Callout)],
	["Note", calloutOf("note", DOC_COMPONENT_PROPS.Note)],
	["Tip", calloutOf("tip", DOC_COMPONENT_PROPS.Tip)],
	["Warning", calloutOf("warning", DOC_COMPONENT_PROPS.Warning)],
	["Danger", calloutOf("danger", DOC_COMPONENT_PROPS.Danger)],
	["Info", calloutOf("note", DOC_COMPONENT_PROPS.Info)],
	["Check", calloutOf("success", DOC_COMPONENT_PROPS.Check)],
	["CodeGroup", mapCodeGroup],
	["FileTree", mapFileTree],
	["Param", mapParam],
	["Example", mapExample],
	["Tabs", mapTabs],
	["Steps", mapSteps],
	["Cards", mapCards],
	["Accordion", mapAccordion],
	["Update", mapUpdate],
]);

/** The block (or accordion or parameter item) a component element becomes, or null when it stays as written. */
export const mapComponent = ({ ctx, node }: { ctx: MapContext; node: MdxNode }): Mapped => COMPONENT_MAPPERS.get(node.name ?? "")?.({ ctx, node }) ?? null;
