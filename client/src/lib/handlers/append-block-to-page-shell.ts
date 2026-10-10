import { findRootPageShell } from "@shared/page-shell-model";
import type { BlockConfig } from "@shared/schema-types";

/**
 * Adds a block at the end of the page's content: the last child of the root page shell. The server
 * places root-level blocks in the same spot when it publishes, so the canvas and the page agree.
 * With no shell, the block goes at the end of the root.
 */
export function appendBlockToPageShell(blocks: BlockConfig[], block: BlockConfig): BlockConfig[] {
	const shell = findRootPageShell(blocks);
	if (!shell) return [...blocks, { ...block, parentId: null }];
	return blocks.map((root) =>
		root.id === shell.id
			? { ...root, children: [...(root.children ?? []), { ...block, parentId: shell.id }] }
			: root,
	);
}
