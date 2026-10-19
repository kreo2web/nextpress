import type { BlockConfig } from "../schema-types.js";
import { type BlockValidationIssue, checkBlockStructure } from "./check-block-structure.js";
import { normalizeBlockTree } from "./normalize-block-tree.js";
import { collectBlockIds, findBlockById, type LocatedBlock, locateBlock } from "./tree-find.js";
import type { BlockPatchOp, TreeChange } from "./types.js";

export type PatchBlockTreeOk = {
	ok: true;
	blocks: BlockConfig[];
	/** Ids by kind of change. For `replaced`, the ids of the new blocks. */
	summary: TreeChange["summary"];
};

export type PatchBlockTreeErr = {
	ok: false;
	error: {
		code: "PATCH_FAILED" | "VALIDATION_FAILED";
		message: string;
		opIndex?: number;
		blockId?: string;
		issues?: BlockValidationIssue[];
	};
};

export type PatchBlockTreeResult = PatchBlockTreeOk | PatchBlockTreeErr;

type AppliedOp = { ok: true; tree: BlockConfig[] } | PatchBlockTreeErr;

const cloneTree = (blocks: BlockConfig[]): BlockConfig[] => structuredClone(blocks);

const clampIndex = (index: number, length: number): number => {
	if (index < 0) return 0;
	if (index > length) return length;
	return index;
};

const fail = (opIndex: number, message: string, blockId?: string): PatchBlockTreeErr => ({
	ok: false,
	error: { code: "PATCH_FAILED", message, opIndex, blockId },
});

/** The list a new child goes into: the page root, or the parent's children (created when missing). */
const findChildrenArray = (tree: BlockConfig[], parentId: string | null): BlockConfig[] | null => {
	if (parentId === null) return tree;
	const parent = findBlockById({ blocks: tree, id: parentId });
	if (!parent) return null;
	if (!parent.children) parent.children = [];
	return parent.children;
};

const isDescendant = (root: BlockConfig, maybeChildId: string | null): boolean => {
	if (!maybeChildId) return false;
	return (root.children ?? []).some(
		(child) => child.id === maybeChildId || isDescendant(child, maybeChildId),
	);
};

const applyInsert = (tree: BlockConfig[], op: Extract<BlockPatchOp, { op: "insert" }>, opIndex: number): AppliedOp => {
	const target = findChildrenArray(tree, op.parentId);
	if (!target) {
		return fail(opIndex, `insert parentId "${op.parentId}" not found`, op.parentId ?? undefined);
	}
	if (findBlockById({ blocks: tree, id: op.block.id })) {
		return fail(opIndex, `insert id "${op.block.id}" already exists`, op.block.id);
	}
	const index = op.index === undefined ? target.length : clampIndex(op.index, target.length);
	target.splice(index, 0, cloneTree([op.block])[0]);
	return { ok: true, tree };
};

const applyUpdate = (tree: BlockConfig[], op: Extract<BlockPatchOp, { op: "update" }>, opIndex: number): AppliedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return fail(opIndex, `update id "${op.id}" not found`, op.id);
	const next: BlockConfig = {
		...located.block,
		...("label" in op.set ? { label: op.set.label } : {}),
		...("content" in op.set ? { content: op.set.content as BlockConfig["content"] } : {}),
		...("styles" in op.set ? { styles: op.set.styles } : {}),
		...("settings" in op.set ? { settings: op.set.settings } : {}),
		...("customCss" in op.set ? { customCss: op.set.customCss } : {}),
		...("other" in op.set ? { other: op.set.other } : {}),
	};
	located.siblings[located.index] = next;
	return { ok: true, tree };
};

const applyDelete = (tree: BlockConfig[], op: Extract<BlockPatchOp, { op: "delete" }>, opIndex: number): AppliedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return fail(opIndex, `delete id "${op.id}" not found`, op.id);
	located.siblings.splice(located.index, 1);
	return { ok: true, tree };
};

const applyMove = (tree: BlockConfig[], op: Extract<BlockPatchOp, { op: "move" }>, opIndex: number): AppliedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return fail(opIndex, `move id "${op.id}" not found`, op.id);
	if (op.parentId === op.id || isDescendant(located.block, op.parentId)) {
		return fail(opIndex, `cannot move "${op.id}" into itself or a descendant`, op.id);
	}
	const [removed] = located.siblings.splice(located.index, 1);
	const dest = findChildrenArray(tree, op.parentId);
	if (!dest) {
		located.siblings.splice(located.index, 0, removed);
		return fail(opIndex, `move parentId "${op.parentId}" not found`, op.parentId ?? undefined);
	}
	const index = op.index === undefined ? dest.length : clampIndex(op.index, dest.length);
	dest.splice(index, 0, removed);
	return { ok: true, tree };
};

/**
 * The new block (and everything in it) may reuse the id of the block it replaces, or of
 * anything inside it, but no id that lives elsewhere on the page.
 */
const findReplaceIdClash = (tree: BlockConfig[], located: LocatedBlock, block: BlockConfig): string | null => {
	const leaving = collectBlockIds([located.block]);
	const outside = new Set([...collectBlockIds(tree)].filter((id) => !leaving.has(id)));
	return [...collectBlockIds([block])].find((id) => outside.has(id)) ?? null;
};

const applyReplace = (tree: BlockConfig[], op: Extract<BlockPatchOp, { op: "replace" }>, opIndex: number): AppliedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return fail(opIndex, `replace id "${op.id}" not found`, op.id);
	const clash = findReplaceIdClash(tree, located, op.block);
	if (clash) return fail(opIndex, `replace: id "${clash}" already exists elsewhere on the page`, clash);
	located.siblings[located.index] = cloneTree([op.block])[0];
	return { ok: true, tree };
};

const applyOne = ({ tree, op, opIndex }: { tree: BlockConfig[]; op: BlockPatchOp; opIndex: number }): AppliedOp => {
	if (op.op === "insert") return applyInsert(tree, op, opIndex);
	if (op.op === "update") return applyUpdate(tree, op, opIndex);
	if (op.op === "delete") return applyDelete(tree, op, opIndex);
	if (op.op === "move") return applyMove(tree, op, opIndex);
	return applyReplace(tree, op, opIndex);
};

/**
 * Apply ordered ops to a block tree, then normalize parentIds and validate. Pure: it never
 * touches the network and never changes the tree it was given. Callers persist the result.
 *
 * `replace` swaps a block and everything inside it for another block in the same spot. It
 * is refused when the id is missing, or when the new block (or anything inside it) uses an
 * id that already lives elsewhere on the page.
 */
export const patchBlockTree = ({
	blocks,
	ops,
	validate = true,
}: {
	blocks: BlockConfig[];
	ops: BlockPatchOp[];
	validate?: boolean;
}): PatchBlockTreeResult => {
	let tree = cloneTree(blocks);
	const summary: TreeChange["summary"] = { inserted: [], updated: [], deleted: [], moved: [], replaced: [] };

	for (let opIndex = 0; opIndex < ops.length; opIndex++) {
		const op = ops[opIndex];
		const applied = applyOne({ tree, op, opIndex });
		if (!applied.ok) return applied;
		tree = applied.tree;
		if (op.op === "insert") summary.inserted.push(op.block.id);
		if (op.op === "update") summary.updated.push(op.id);
		if (op.op === "delete") summary.deleted.push(op.id);
		if (op.op === "move") summary.moved.push(op.id);
		if (op.op === "replace") summary.replaced.push(op.block.id);
	}

	const normalized = normalizeBlockTree(tree, null);

	if (validate) {
		const validation = checkBlockStructure(normalized);
		if (!validation.ok) {
			return {
				ok: false,
				error: { code: "VALIDATION_FAILED", message: "Patched tree failed validation", issues: validation.issues },
			};
		}
	}

	return { ok: true, blocks: normalized, summary };
};
