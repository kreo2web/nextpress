import type { BlockConfig } from "../schema-types.js";
import { findBlockById, subtreeHasId } from "./tree-find.js";
import type { BlockPatchOp } from "./types.js";

/** True when `id` is the focus block or sits anywhere under it. Null focus allows everything. */
export const isInsideFocus = ({
	blocks,
	focusBlockId,
	id,
}: {
	blocks: BlockConfig[];
	focusBlockId: string | null | undefined;
	id: string;
}): boolean => {
	if (!focusBlockId) return true;
	const focus = findBlockById({ blocks, id: focusBlockId });
	return focus ? subtreeHasId({ root: focus, id }) : false;
};

const outside = (focusBlockId: string, what: string): string =>
	`${what} is outside the selected block (id ${focusBlockId}). Only the selected block and what is inside it can change.`;

/**
 * Why a change is refused because of the selected block, or null when it is allowed.
 *
 * A change is inside the focus when its target is the focus block or under it and, for
 * insert and move, the destination parent is too. Deleting or moving the focus block
 * itself is refused (the person asked for a change to it, not for it to go or travel);
 * replacing it is allowed. Without a focus everything is allowed.
 *
 * WHY enforced here: the person selected one block; the rest of the page must not move
 * whatever the model decides to do.
 */
export const explainFocusRefusal = ({
	blocks,
	focusBlockId,
	op,
}: {
	blocks: BlockConfig[];
	focusBlockId: string | null | undefined;
	op: BlockPatchOp;
}): string | null => {
	if (!focusBlockId) return null;
	if (!findBlockById({ blocks, id: focusBlockId })) {
		return `The selected block (id ${focusBlockId}) is no longer on the page. Read the outline again.`;
	}
	const inside = (id: string): boolean => isInsideFocus({ blocks, focusBlockId, id });
	const parentName = (parentId: string | null): string => (parentId === null ? "The page root" : `Block ${parentId}`);

	if (op.op === "insert") {
		return op.parentId !== null && inside(op.parentId) ? null : outside(focusBlockId, parentName(op.parentId));
	}
	if (!inside(op.id)) return outside(focusBlockId, `Block ${op.id}`);

	if (op.op === "delete" && op.id === focusBlockId) {
		return `The selected block (id ${focusBlockId}) can't be deleted. Delete something inside it, or replace it.`;
	}
	if (op.op === "move") {
		if (op.id === focusBlockId) return `The selected block (id ${focusBlockId}) can't be moved.`;
		if (op.parentId === null || !inside(op.parentId)) return outside(focusBlockId, parentName(op.parentId));
	}
	return null;
};
