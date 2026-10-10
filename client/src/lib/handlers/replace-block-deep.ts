import type { BlockConfig } from "@shared/schema-types";

/**
 * Swaps the block with `targetId` for `replacement`, in the same place among its siblings, at any
 * depth. Detach uses it to turn one part into the blocks it showed. When the block is not in the
 * tree the same array comes back, so the caller can skip the update.
 */
export function replaceBlockDeep(
	blocks: BlockConfig[],
	targetId: string,
	replacement: BlockConfig[],
): BlockConfig[] {
	return replaceInList(blocks, targetId, replacement) ?? blocks;
}

function replaceInList(
	list: BlockConfig[],
	targetId: string,
	replacement: BlockConfig[],
): BlockConfig[] | null {
	const index = list.findIndex((block) => block.id === targetId);
	if (index >= 0) return [...list.slice(0, index), ...replacement, ...list.slice(index + 1)];

	for (let i = 0; i < list.length; i += 1) {
		const block = list[i];
		if (!Array.isArray(block.children)) continue;
		const children = replaceInList(block.children, targetId, replacement);
		if (children) return [...list.slice(0, i), { ...block, children }, ...list.slice(i + 1)];
	}
	return null;
}
