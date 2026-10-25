import { CALLOUT_BLOCK_NAME, readCalloutType } from "../blocks/callout-model.js";
import { CODE_EXAMPLE_BLOCK_NAME, readCodeExampleContent } from "../blocks/code-example-model.js";
import { CODE_GROUP_BLOCK_NAME } from "../blocks/code-group-model.js";
import { readCardContent } from "../blocks/card-model.js";
import { FILE_TREE_BLOCK_NAME } from "../blocks/file-tree-model.js";
import { readGridContent } from "../blocks/grid-model.js";
import { PARAMS_BLOCK_NAME, readParamsContent, shownParams } from "../blocks/params-model.js";
import { DEFAULT_STEP_ICON, readStepContent, readStepsContent } from "../blocks/steps-model.js";
import { readUpdateContent, UPDATE_BLOCK_NAME } from "../blocks/update-model.js";
import { readString } from "../content-text/html-text.js";
import { safeHref } from "../markdown/safe-href.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import { attr, type BlockWriter, escapeTreeLine, oneLine, wrapBlocks } from "./write-text.js";
import { dataOf } from "./write-data.js";

/**
 * A file tree's lines as the nested list `<FileTree>` reads: one item per line, two spaces per level. A line
 * indented deeper than the one before it is written one level down, as the tree reader would take it.
 */
const treeAsList = (tree: string): string => {
	const levelOf = (line: string): number => {
		const spaced = line.replace(/\t/g, "  ").replace(/\s+$/, "");
		return Math.round((spaced.length - spaced.trimStart().length) / 2);
	};
	let previous = -1;
	return tree
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const level = Math.min(levelOf(line), previous + 1);
			previous = level;
			return `${"  ".repeat(level)}- ${escapeTreeLine(line.trim())}`;
		})
		.join("\n");
};

const calloutWriter: BlockWriter = ({ block, ctx }) => {
	const data = dataOf(block);
	const open = `<Callout${attr("type", readCalloutType(data.type))}${attr("title", readString(data.title))}>`;
	return wrapBlocks({ open, close: "</Callout>", inner: ctx.writeChildren(block.children ?? []) });
};

const codeGroupWriter: BlockWriter = ({ block, ctx }) =>
	wrapBlocks({ open: "<CodeGroup>", close: "</CodeGroup>", inner: ctx.writeChildren(block.children ?? []) });

const fileTreeWriter: BlockWriter = ({ block }) =>
	wrapBlocks({ open: "<FileTree>", close: "</FileTree>", inner: treeAsList(readString(dataOf(block).tree)) });

/** Parameters, one `<Param>` per line, so consecutive lines read back as one list. Nameless rows are left out, as the views leave them out. */
const paramsWriter: BlockWriter = ({ block }) =>
	shownParams(readParamsContent(block.content).items)
		.map(
			(item) =>
				`<Param${attr("name", item.name)}${attr("type", item.type)}${attr("default", item.default)}${item.required ? " required" : ""}>${oneLine(item.description)}</Param>`,
		)
		.join("\n");

const exampleWriter: BlockWriter = ({ block, ctx }) => {
	const { layout } = readCodeExampleContent(block.content);
	return wrapBlocks({ open: `<Example${layout === "stacked" ? ' layout="stacked"' : ""}>`, close: "</Example>", inner: ctx.writeChildren(block.children ?? []) });
};

const updateWriter: BlockWriter = ({ block, ctx }) => {
	const { label, description } = readUpdateContent(block.content);
	return wrapBlocks({
		open: `<Update${attr("label", label)}${attr("description", description)}>`,
		close: "</Update>",
		inner: ctx.writeChildren(block.children ?? []),
	});
};

const tabsWriter: BlockWriter = ({ block, ctx }) => wrapBlocks({ open: "<Tabs>", close: "</Tabs>", inner: ctx.writeChildren(block.children ?? []) });

const tabWriter: BlockWriter = ({ block, ctx }) =>
	wrapBlocks({ open: `<Tab${attr("title", readString(dataOf(block).title))}>`, close: "</Tab>", inner: ctx.writeChildren(block.children ?? []) });

/** The marker is written only when it isn't the default (numbers). */
const stepsWriter: BlockWriter = ({ block, ctx }) => {
	const { marker } = readStepsContent(block.content);
	return wrapBlocks({ open: `<Steps${attr("marker", marker === "number" ? "" : marker)}>`, close: "</Steps>", inner: ctx.writeChildren(block.children ?? []) });
};

/** The icon is written by its Lucide name, and only when it isn't the default check mark (other icon sets have no MDX form). */
const stepWriter: BlockWriter = ({ block, ctx }) => {
	const { title, icon } = readStepContent(block.content);
	const iconName = icon.iconSet === "lucide" && icon.iconName !== DEFAULT_STEP_ICON.iconName ? icon.iconName : "";
	return wrapBlocks({ open: `<Step${attr("title", title)}${attr("icon", iconName)}>`, close: "</Step>", inner: ctx.writeChildren(block.children ?? []) });
};

/** Cards: the column count, at most 4 (the most the tag reads). */
const cardsWriter: BlockWriter = ({ block, ctx }) => {
	const { columns } = readGridContent(block.content);
	return wrapBlocks({ open: `<Cards${attr("cols", String(Math.min(4, columns)))}>`, close: "</Cards>", inner: ctx.writeChildren(block.children ?? []) });
};

/** A card's link is written only when it is one the page may keep (`safeHref`), the same rule the reader applies. */
const cardWriter: BlockWriter = ({ block, ctx }) => {
	const { title, link } = readCardContent(block.content);
	const href = safeHref(link) === link ? link : "";
	return wrapBlocks({ open: `<Card${attr("title", title)}${attr("href", href)}>`, close: "</Card>", inner: ctx.writeChildren(block.children ?? []) });
};

/** An accordion is its items, one `<Accordion>` each, so consecutive items read back as one accordion. */
const accordionWriter: BlockWriter = ({ block, ctx }) => ctx.writeChildren(block.children ?? []);

const accordionItemWriter: BlockWriter = ({ block, ctx }) =>
	wrapBlocks({ open: `<Accordion${attr("title", readString(dataOf(block).title))}>`, close: "</Accordion>", inner: ctx.writeChildren(block.children ?? []) });

/**
 * Component blocks, by name, in the one canonical spelling each reader accepts: `<Callout type="…">` (never
 * the short forms), `<CodeGroup>`, `<FileTree>` around a list, one `<Param>` per line, `<Example>`,
 * `<Update label description>`, `<Tabs>` / `<Tab title>`, `<Steps marker>` / `<Step title icon>`, `<Cards
 * cols>` / `<Card title href>`, and one `<Accordion title>` per item.
 */
export const COMPONENT_WRITERS: ReadonlyArray<[string, BlockWriter]> = [
	[CALLOUT_BLOCK_NAME, calloutWriter],
	[CODE_GROUP_BLOCK_NAME, codeGroupWriter],
	[FILE_TREE_BLOCK_NAME, fileTreeWriter],
	[PARAMS_BLOCK_NAME, paramsWriter],
	[CODE_EXAMPLE_BLOCK_NAME, exampleWriter],
	[UPDATE_BLOCK_NAME, updateWriter],
	[CORE_BLOCK_NAMES.tabs, tabsWriter],
	[CORE_BLOCK_NAMES.tab, tabWriter],
	[CORE_BLOCK_NAMES.steps, stepsWriter],
	[CORE_BLOCK_NAMES.step, stepWriter],
	[CORE_BLOCK_NAMES.grid, cardsWriter],
	[CORE_BLOCK_NAMES.card, cardWriter],
	[CORE_BLOCK_NAMES.accordion, accordionWriter],
	[CORE_BLOCK_NAMES.accordionItem, accordionItemWriter],
];
