import { HEADER_BLOCK_NAME } from "../header-model.js";
import { findRootPageShell, PAGE_SHELL_BLOCK_NAME } from "../page-shell-model.js";
import type { BlockConfig } from "../schema-types.js";

/**
 * Where a block dropped at the page root really goes. When the page has a page shell, every
 * block except the shell itself belongs inside it; a header always goes first. The editor
 * and the page tools both use this, so a block an agent adds lands where a person's would.
 *
 * `index` is the wanted position in the destination list; it is clamped to the shell's
 * children. Any destination other than the root is returned unchanged.
 */
export const retargetRootIntoShell = ({
	blocks,
	name,
	parentId,
	index,
}: {
	blocks: BlockConfig[];
	/** Name of the block being placed, e.g. `core/header`. */
	name: string;
	parentId: string | null;
	index: number;
}): { parentId: string | null; index: number } => {
	if (parentId !== null || name === PAGE_SHELL_BLOCK_NAME) return { parentId, index };
	const shell = findRootPageShell(blocks);
	if (!shell) return { parentId, index };
	const childCount = Array.isArray(shell.children) ? shell.children.length : 0;
	return {
		parentId: shell.id,
		index: name === HEADER_BLOCK_NAME ? 0 : Math.min(Math.max(index, 0), childCount),
	};
};
