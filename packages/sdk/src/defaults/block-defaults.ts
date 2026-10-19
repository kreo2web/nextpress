import { BLOCK_DEFINITIONS } from "../blocks/block-definitions.js";
import { createBlockId } from "../blocks/create-block-id.js";
import {
	getBlockEntry,
	INSERTED_BLOCK_BASE_STYLES,
	isBlockName,
	newBlockOther,
} from "../blocks/shared-catalog.js";
import type { BlockConfig } from "../types/domain.js";

/**
 * Applies editor-native block scaffolding so SDK-built trees match dashboard inserts.
 * Layers, lowest first: the editor's base spacing, the block's own defaults, then the caller's
 * styles. Caller styles and `other` fields win on conflict.
 */
export const applySdkBlockDefaults = (block: BlockConfig): BlockConfig => {
	const def = isBlockName(block.name) ? BLOCK_DEFINITIONS[block.name] : undefined;

	const withDefaults: BlockConfig = {
		...block,
		styles: {
			...INSERTED_BLOCK_BASE_STYLES,
			...(def?.defaultStyles ?? {}),
			...block.styles,
		},
		settings: block.settings ?? {},
		other: {
			...newBlockOther(),
			...(block.other ?? {}),
		},
	};

	if (block.children?.length) {
		withDefaults.children = block.children.map(applySdkBlockDefaults);
	}

	return withDefaults;
};

/** Applies block defaults to every root block in a page tree. */
export const applySdkBlockTreeDefaults = (blocks: BlockConfig[]): BlockConfig[] =>
	blocks.map(applySdkBlockDefaults);

/**
 * Gives a container the children the editor starts it with (an accordion's three items, a form's
 * fields). Children the caller passed win, even an empty list; a container with none stays `[]`.
 * Run this after `applySdkBlockDefaults`: the editor's starting children carry no base spacing.
 */
export const withStartingChildren = (block: BlockConfig): BlockConfig => {
	if (block.type !== "container" || block.children !== undefined || !isBlockName(block.name)) {
		return block;
	}
	const startingChildren = getBlockEntry(block.name).defaultChildren;
	return {
		...block,
		children: startingChildren
			? startingChildren({ parentId: block.id, newId: createBlockId })
			: [],
	};
};
