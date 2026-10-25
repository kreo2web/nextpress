import { readStructuredData, readText } from "../../blocks/read-structured.js";
import type { BlockConfig } from "../../schema-types.js";

export const CODE_BLOCK_NAME = "core/code";

export type CodeGroupTab = { block: BlockConfig; title: string; language: string };

/** The text fields of a code block that name its tab. */
const readCodeNames = (block: BlockConfig): { title: string; language: string } => {
	const data = readStructuredData(block.content);
	return { title: readText(data.title), language: readText(data.language) };
};

/**
 * A code group's children sorted into its tabs (the `core/code` blocks, with what names each tab)
 * and the rest, which show after the panels. One place for the published page and the editor.
 */
export const readCodeGroupTabs = (children: readonly BlockConfig[]): { codes: CodeGroupTab[]; others: BlockConfig[] } => ({
	codes: children.filter((child) => child.name === CODE_BLOCK_NAME).map((block) => ({ block, ...readCodeNames(block) })),
	others: children.filter((child) => child.name !== CODE_BLOCK_NAME),
});
