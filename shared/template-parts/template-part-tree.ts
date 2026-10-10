import type { BlockConfig } from "../schema-types.js";
import { PAGE_SHELL_BLOCK_NAME } from "../page-shell-model.js";
import { reIdBlocks } from "../re-id-blocks.js";
import { isTemplatePartBlock, readTemplatePartId } from "./template-part-block.js";

/** Every block in the tree, parents before their children. */
export function flattenBlockTree(blocks: readonly BlockConfig[]): BlockConfig[] {
	return blocks.flatMap((block) => [block, ...flattenBlockTree(block.children ?? [])]);
}

/** True when any block in the tree is a template part. Callers use it to skip template lookups for plain pages. */
export function hasTemplatePartBlock(blocks: readonly BlockConfig[]): boolean {
	return flattenBlockTree(blocks).some(isTemplatePartBlock);
}

/** Template ids the tree points at, in first-seen order, each id once. */
export function collectTemplatePartIds(blocks: readonly BlockConfig[]): string[] {
	const ids = flattenBlockTree(blocks)
		.filter(isTemplatePartBlock)
		.map(readTemplatePartId)
		.filter((id): id is string => id !== null);
	return [...new Set(ids)];
}

/**
 * A template saved in the builder is wrapped in a root page shell. That shell carries the design
 * of the template editor, not the design of the page it lands on. A part keeps the shell's
 * children and drops the shell itself.
 */
export function unwrapPageShells(blocks: readonly BlockConfig[]): BlockConfig[] {
	return blocks.flatMap((block) =>
		block.name === PAGE_SHELL_BLOCK_NAME
			? unwrapPageShells(block.children ?? [])
			: [block],
	);
}

/**
 * The blocks that stand in for a template part: the template's blocks with the page shell removed,
 * fresh ids (so one template can appear twice on a page), and the part's parent as their parent.
 * Used by the server when it publishes a page and by the editor when a part is detached.
 */
export function copyTemplateBlocks({
	templateBlocks,
	parentId,
	generateId,
}: {
	templateBlocks: readonly BlockConfig[];
	parentId: string | null;
	generateId: () => string;
}): BlockConfig[] {
	return reIdBlocks({ blocks: unwrapPageShells(templateBlocks), generateId }).map((block) => ({
		...block,
		parentId,
	}));
}
