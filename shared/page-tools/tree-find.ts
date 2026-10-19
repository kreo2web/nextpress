import type { BlockConfig } from "../schema-types.js";

export type LocatedBlock = {
	block: BlockConfig;
	/** The list the block sits in: the page root or its parent's children. */
	siblings: BlockConfig[];
	index: number;
	parentId: string | null;
};

/** Finds a block anywhere in the tree, with the list it sits in. Depth first; the first match wins. */
export const locateBlock = ({ blocks, id }: { blocks: BlockConfig[]; id: string }): LocatedBlock | null => {
	const search = (nodes: BlockConfig[], parentId: string | null): LocatedBlock | null => {
		for (let index = 0; index < nodes.length; index++) {
			const block = nodes[index];
			if (block.id === id) return { block, siblings: nodes, index, parentId };
			if (block.children?.length) {
				const found = search(block.children, block.id);
				if (found) return found;
			}
		}
		return null;
	};
	return search(blocks, null);
};

/** The block with this id, or null. */
export const findBlockById = ({ blocks, id }: { blocks: BlockConfig[]; id: string }): BlockConfig | null =>
	locateBlock({ blocks, id })?.block ?? null;

/** Visits every block, parents before children, with its depth (root blocks are 0). */
export const walkBlocks = ({
	blocks,
	visit,
}: {
	blocks: BlockConfig[];
	visit: (block: BlockConfig, depth: number) => void;
}): void => {
	const walk = (nodes: BlockConfig[], depth: number): void => {
		for (const block of nodes) {
			visit(block, depth);
			if (block.children?.length) walk(block.children, depth + 1);
		}
	};
	walk(blocks, 0);
};

/** Every id in the tree. */
export const collectBlockIds = (blocks: BlockConfig[]): Set<string> => {
	const ids = new Set<string>();
	walkBlocks({ blocks, visit: (block) => ids.add(block.id) });
	return ids;
};

/** How many blocks the tree holds, nested ones included. */
export const countBlocks = (blocks: BlockConfig[]): number => {
	let count = 0;
	walkBlocks({ blocks, visit: () => count++ });
	return count;
};

/** True when `id` is the root block itself or sits anywhere under it. */
export const subtreeHasId = ({ root, id }: { root: BlockConfig; id: string }): boolean =>
	collectBlockIds([root]).has(id);
