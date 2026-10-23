import type { BlockConfig } from "../schema-types.js";
import { ensureRootPageShell, findRootPageShell, PAGE_SHELL_BLOCK_NAME } from "../page-shell-model.js";
import type { ChangeOp } from "./block-spec-schema.js";
import { buildBlockFromSpec } from "./build-from-spec.js";
import { mergeBlockUpdate } from "./merge-block-update.js";
import { retargetRootIntoShell } from "./retarget-root-into-shell.js";
import { collectBlockIds, findBlockById, locateBlock, subtreeHasId } from "./tree-find.js";
import type { BlockPatchOp, PageToolContext } from "./types.js";

/** One agent op turned into a real patch op, or the reason it can't be. */
export type ConvertedOp =
	| {
			ok: true;
			patchOp: BlockPatchOp;
			/** The new block, for insert and replace. */
			made?: BlockConfig;
			/** Said to the agent when the op did not land exactly where it asked. */
			note?: string;
			/** Ids the op created or changed, so phone warnings can be limited to them. */
			touched: string[];
	  }
	| { ok: false; text: string };

type ConvertParams<O extends ChangeOp> = { ctx: PageToolContext; tree: BlockConfig[]; op: O };
type OpOf<K extends ChangeOp["op"]> = Extract<ChangeOp, { op: K }>;

/** "At the end" for the root-into-shell rule, which clamps the position. */
const END = Number.MAX_SAFE_INTEGER;

const refuse = (text: string): ConvertedOp => ({ ok: false, text });
const noBlock = (id: string): string =>
	`No block with id ${id}. Read the outline again for ids; a ref only works in ops after the one that made it, in the same call.`;

const findParent = ({ tree, parentId }: { tree: BlockConfig[]; parentId: string | null }): BlockConfig | null =>
	parentId === null ? null : findBlockById({ blocks: tree, id: parentId });

/**
 * Every page has one page shell; the server wraps any page without one when it saves. On an
 * empty page the first block placed at the root gets that same shell now, so the agent never
 * builds one and its next root insert already lands inside it.
 */
const wrapInNewShell = ({ ctx, block }: { ctx: PageToolContext; block: BlockConfig }): BlockConfig =>
	ensureRootPageShell({ blocks: [block], shellId: ctx.newId() }).blocks[0];

/** Some models put the label on the op instead of inside the block. Take it either way; the block wins. */
const labelFromOp = <Spec extends { label?: string }>({ spec, label }: { spec: Spec; label?: string }): Spec =>
	label !== undefined && spec.label === undefined ? { ...spec, label } : spec;

/** Checks a parent exists and can hold blocks; returns why not, or null. */
const explainBadParent = ({ tree, parentId }: { tree: BlockConfig[]; parentId: string | null }): string | null => {
	if (parentId === null) return null;
	const parent = findBlockById({ blocks: tree, id: parentId });
	if (!parent) return noBlock(parentId);
	if (parent.type !== "container") {
		return `Block ${parent.id} (${parent.name}) can't hold other blocks. Use a container such as core/stack as the parent.`;
	}
	return null;
};

const convertInsert = ({ ctx, tree, op }: ConvertParams<OpOf<"insert">>): ConvertedOp => {
	const { name } = op.block;
	const shell = findRootPageShell(tree);
	if (name === PAGE_SHELL_BLOCK_NAME && shell) {
		return refuse(`The page already has a page shell (id ${shell.id}). Add sections inside it instead.`);
	}
	const target = retargetRootIntoShell({ blocks: tree, name, parentId: op.parentId, index: op.index ?? END });
	const retargeted = target.parentId !== op.parentId;
	const badParent = explainBadParent({ tree, parentId: target.parentId });
	if (badParent) return refuse(badParent);

	const built = buildBlockFromSpec({
		spec: labelFromOp({ spec: op.block, label: op.label }),
		parentId: target.parentId,
		parent: findParent({ tree, parentId: target.parentId }),
		newId: ctx.newId,
	});
	if (!built.ok) return refuse(built.message);
	if (target.parentId === null && name !== PAGE_SHELL_BLOCK_NAME && tree.length === 0) {
		const newShell = wrapInNewShell({ ctx, block: built.value });
		return {
			ok: true,
			patchOp: { op: "insert", parentId: null, index: 0, block: newShell },
			made: newShell.children?.[0] ?? built.value,
			note: `placed inside a new page shell (id ${newShell.id}); every page has one`,
			touched: [...collectBlockIds([newShell])],
		};
	}
	return {
		ok: true,
		patchOp: { op: "insert", parentId: target.parentId, index: retargeted ? target.index : op.index, block: built.value },
		made: built.value,
		note: retargeted ? `placed inside the page shell (id ${target.parentId})` : undefined,
		touched: [...collectBlockIds([built.value])],
	};
};

const convertUpdate = ({ tree, op }: ConvertParams<OpOf<"update">>): ConvertedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return refuse(noBlock(op.id));
	const merged = mergeBlockUpdate({
		block: located.block,
		parent: findParent({ tree, parentId: located.parentId }),
		label: op.label,
		content: op.content,
		styles: op.styles,
		fillBehind: op.fillBehind,
	});
	if (!merged.ok) return refuse(merged.message);
	return { ok: true, patchOp: merged.value, touched: [op.id] };
};

const convertDelete = ({ tree, op }: ConvertParams<OpOf<"delete">>): ConvertedOp => {
	const block = findBlockById({ blocks: tree, id: op.id });
	if (!block) return refuse(noBlock(op.id));
	if (block.name === PAGE_SHELL_BLOCK_NAME) {
		return refuse(`Block ${op.id} is the page shell and can't be deleted. Delete the blocks inside it instead.`);
	}
	return { ok: true, patchOp: { op: "delete", id: op.id }, touched: [] };
};

const convertMove = ({ tree, op }: ConvertParams<OpOf<"move">>): ConvertedOp => {
	const block = findBlockById({ blocks: tree, id: op.id });
	if (!block) return refuse(noBlock(op.id));
	if (op.parentId !== null && subtreeHasId({ root: block, id: op.parentId })) {
		return refuse(`Block ${op.id} can't be moved into itself or into something inside it.`);
	}
	const target = retargetRootIntoShell({ blocks: tree, name: block.name, parentId: op.parentId, index: op.index ?? END });
	const retargeted = target.parentId !== op.parentId;
	const badParent = explainBadParent({ tree, parentId: target.parentId });
	if (badParent) return refuse(badParent);
	return {
		ok: true,
		patchOp: { op: "move", id: op.id, parentId: target.parentId, index: retargeted ? target.index : op.index },
		note: retargeted ? `placed inside the page shell (id ${target.parentId})` : undefined,
		touched: [op.id],
	};
};

const convertReplace = ({ ctx, tree, op }: ConvertParams<OpOf<"replace">>): ConvertedOp => {
	const located = locateBlock({ blocks: tree, id: op.id });
	if (!located) return refuse(noBlock(op.id));
	if (located.block.name === PAGE_SHELL_BLOCK_NAME && op.block.name !== PAGE_SHELL_BLOCK_NAME) {
		return refuse(`Block ${op.id} is the page shell and can't be replaced by another kind of block. Replace the blocks inside it instead.`);
	}
	// The selected block keeps its id, so the selection (and the focus rule) still point at it.
	let keepId = op.id === ctx.focusBlockId;
	const newId = (): string => {
		if (!keepId) return ctx.newId();
		keepId = false;
		return op.id;
	};
	const built = buildBlockFromSpec({
		spec: labelFromOp({ spec: op.block, label: op.label }),
		parentId: located.parentId,
		parent: findParent({ tree, parentId: located.parentId }),
		newId,
	});
	if (!built.ok) return refuse(built.message);
	return {
		ok: true,
		patchOp: { op: "replace", id: op.id, block: built.value },
		made: built.value,
		touched: [...collectBlockIds([built.value])],
	};
};

/**
 * Turns one agent op into a patch op with real ids, against the page as it stands after
 * the ops before it. Checks the things only this layer knows (the page shell rules, root
 * inserts going into the shell, the first block on an empty page getting one, the selected
 * block keeping its id) and names the id and the next step in every refusal.
 */
export const convertOp = ({ ctx, tree, op }: ConvertParams<ChangeOp>): ConvertedOp => {
	switch (op.op) {
		case "insert":
			return convertInsert({ ctx, tree, op });
		case "update":
			return convertUpdate({ ctx, tree, op });
		case "delete":
			return convertDelete({ ctx, tree, op });
		case "move":
			return convertMove({ ctx, tree, op });
		case "replace":
			return convertReplace({ ctx, tree, op });
	}
};
