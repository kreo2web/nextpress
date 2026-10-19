import type { BlockContent } from "../types/domain.js";
import {
	BLOCK_NAMES,
	type BlockCatalogEntry,
	type BlockName,
	getBlockEntry,
	isBlockName,
} from "./shared-catalog.js";

export type { BlockName };
/** All canonical block names registered in the NextPress page builder. */
export { BLOCK_NAMES, isBlockName };

export type BlockDefinitionMeta = {
	name: BlockName;
	label: string;
	/** Shown to people in the block library. */
	description: string;
	type: "block" | "container";
	category: "basic" | "form" | "layout" | "media" | "advanced" | "post";
	defaultContent: () => BlockContent;
	defaultStyles?: Record<string, string>;
};

const toDefinition = (entry: BlockCatalogEntry): BlockDefinitionMeta => ({
	name: entry.name,
	label: entry.label,
	description: entry.description,
	type: entry.kind,
	category: entry.category,
	defaultContent: entry.defaultContent,
	defaultStyles: entry.defaultStyles,
});

/**
 * Default block payloads, read from the shared block list the editor and the server also use,
 * so a block built here starts the same as one a person inserts in the editor.
 */
// Cast: `fromEntries` types its keys as `string`; `getBlockEntry` throws on a missing name, so every `BlockName` is present.
export const BLOCK_DEFINITIONS = Object.fromEntries(
	BLOCK_NAMES.map((name) => [name, toDefinition(getBlockEntry(name))]),
) as Record<BlockName, BlockDefinitionMeta>;
