import type { BlockConfig } from "../schema-types.js";
import { type ChangeOp, changeBlocksShape, MAX_NEW_BLOCKS_PER_CALL, MAX_OPS_PER_CALL } from "./block-spec-schema.js";
import { addSummary, type CommittedChange, commitTree, describeExistingProblems, emptySummary } from "./commit-change.js";
import { type ConvertedOp, convertOp } from "./convert-op.js";
import { explainFocusRefusal } from "./focus.js";
import { formatProblems } from "./format-problems.js";
import { outlinePage } from "./outline-page.js";
import { patchBlockTree } from "./patch-block-tree.js";
import { defineTool, readPageTree, type SerialQueue } from "./tool-helpers.js";
import { countBlocks, findBlockById } from "./tree-find.js";
import type { BlockPatchOp, BlockSpec, PageTool, PageToolContext, PageToolResult, TreeChange } from "./types.js";

/** Created subtrees bigger than this are shown folded in the result. */
const FULL_OUTLINE_LIMIT = 40;
const FOLDED_OUTLINE_DEPTH = 2;

const DESCRIPTION = `Change the page: insert, update, delete, move or replace blocks. Send 1 to ${MAX_OPS_PER_CALL} ops in one call. They run in order and are all-or-nothing: if an op is wrong, or the change would add a problem the server would refuse, nothing changes and the reply says why, so fix it and send the whole call again. Problems the page already had do not block a change; the reply names them.

Ops (each has "op" and ids from get_page_outline):
- insert { parentId, index?, block }: add a new block. parentId is a container's id, or null for the page root (at the root, blocks go inside the page shell when the page has one). Leave index out to add at the end.
- update { id, label?, content?, styles? }: change fields of one block. Only the fields you send change; everything else stays. A null value removes that field or style.
- delete { id }: remove a block and everything inside it. The page shell can't be deleted.
- move { id, parentId, index? }: move a block (and what is inside it) to another container, or to the root with null.
- replace { id, block }: swap a block and everything inside it for a new block in the same place.

A block is { name, label?, content?, styles?, children? }. It starts exactly as the editor would insert it (default content, styles and starting children, such as an accordion's first items or a form's fields), then your content and styles are laid over that. Call get_block_type first to see a block's content fields. Children replace the starting children and only containers can have them. A block nests four levels deep in one call (the block plus three levels of children); for a deeper tree, insert the outer blocks first, then insert more into the ids this tool returns.

Limits: ${MAX_OPS_PER_CALL} ops and ${MAX_NEW_BLOCKS_PER_CALL} new blocks per call. When the person selected a block, only that block and what is inside it can change; the selected block itself can be updated or replaced but not deleted or moved.

Returns what changed, the new blocks as an outline with their ids (use those ids in later calls), and phone-layout warnings for the blocks you touched. Warnings don't block the change; apply_phone_fixes fixes them. Work in small steps: one section per call, then check_page.`;

const countSpecNodes = (spec: BlockSpec): number =>
	1 + (spec.children ?? []).reduce((total, child) => total + countSpecNodes(child), 0);

const specOf = (op: ChangeOp): BlockSpec | null => (op.op === "insert" || op.op === "replace" ? op.block : null);

type Created = { opNumber: number; op: ChangeOp["op"]; block: BlockConfig; note?: string };

type Applied = {
	before: BlockConfig[];
	after: BlockConfig[];
	patchOps: BlockPatchOp[];
	summary: TreeChange["summary"];
	created: Created[];
	touched: Set<string>;
};

type ApplyOutcome = { ok: true; value: Applied } | { ok: false; text: string };

const refuse = (text: string): ApplyOutcome => ({ ok: false, text: `Nothing was changed. ${text}` });

/**
 * Turns the agent's ops into patch ops one at a time, each against the page as the ops
 * before it left it (so a root insert after a new page shell lands inside that shell).
 * Stops at the first op that is wrong, outside the selected block, or over the limits.
 */
const applyOps = ({ ctx, tree, ops }: { ctx: PageToolContext; tree: BlockConfig[]; ops: ChangeOp[] }): ApplyOutcome => {
	const applied: Applied = {
		before: tree,
		after: tree,
		patchOps: [],
		summary: emptySummary(),
		created: [],
		touched: new Set<string>(),
	};
	let createdCount = 0;

	for (const [index, op] of ops.entries()) {
		const opNumber = index + 1;
		const label = `Op ${opNumber} (${op.op})`;

		const spec = specOf(op);
		if (spec && createdCount + countSpecNodes(spec) > MAX_NEW_BLOCKS_PER_CALL) {
			return refuse(`${label}: this call would create more than ${MAX_NEW_BLOCKS_PER_CALL} blocks. Split the work into several calls.`);
		}

		const converted: ConvertedOp = convertOp({ ctx, tree: applied.after, op });
		if (!converted.ok) return refuse(`${label}: ${converted.text}`);

		const focusRefusal = explainFocusRefusal({
			blocks: applied.after,
			focusBlockId: ctx.focusBlockId,
			op: converted.patchOp,
		});
		if (focusRefusal) return refuse(`${label}: ${focusRefusal}`);

		if (converted.made) createdCount += countBlocks([converted.made]);
		if (createdCount > MAX_NEW_BLOCKS_PER_CALL) {
			return refuse(`${label}: this call would create more than ${MAX_NEW_BLOCKS_PER_CALL} blocks. Split the work into several calls.`);
		}

		const patched = patchBlockTree({ blocks: applied.after, ops: [converted.patchOp], validate: false });
		if (!patched.ok) return refuse(`${label}: ${patched.error.message}.`);

		applied.after = patched.blocks;
		applied.patchOps.push(converted.patchOp);
		addSummary({ into: applied.summary, from: patched.summary });
		converted.touched.forEach((id) => applied.touched.add(id));
		if (converted.made) {
			applied.created.push({ opNumber, op: op.op, block: converted.made, note: converted.note });
		}
	}
	return { ok: true, value: applied };
};

const describeCounts = (summary: TreeChange["summary"]): string => {
	const parts = [
		["inserted", summary.inserted.length],
		["updated", summary.updated.length],
		["deleted", summary.deleted.length],
		["moved", summary.moved.length],
		["replaced", summary.replaced.length],
	] as const;
	return parts.filter(([, count]) => count > 0).map(([word, count]) => `${word} ${count}`).join(", ");
};

const describeCreated = (created: Created[], after: BlockConfig[]): string[] =>
	created.flatMap(({ opNumber, op, block, note }) => {
		// The block as it now sits on the page, with parent ids set.
		const current = findBlockById({ blocks: after, id: block.id }) ?? block;
		const big = countBlocks([current]) > FULL_OUTLINE_LIMIT;
		const outline = outlinePage({
			blocks: [current],
			maxText: 40,
			maxDepth: big ? FOLDED_OUTLINE_DEPTH : undefined,
		});
		const indented = outline.split("\n").map((line) => `  ${line}`);
		return [
			`Op ${opNumber} (${op}) made${note ? `, ${note}` : ""}:`,
			...indented,
			...(big ? ["  (deeper blocks are folded; call get_block with an id to read one)"] : []),
		];
	});

/** What the agent reads after an accepted change. */
const describeCommit = ({ applied, committed }: { applied: Applied; committed: CommittedChange }): string => {
	const lines = [
		`Done: ${describeCounts(applied.summary) || "no changes"}.`,
		...describeCreated(applied.created, committed.blocks),
	];
	if (committed.phoneWarnings.length > 0) {
		lines.push(
			"Phone warnings for blocks you touched (the change was applied; apply_phone_fixes fixes them):",
			formatProblems({ problems: committed.phoneWarnings, max: 8 }),
		);
	}
	lines.push(...describeExistingProblems(committed.existingProblems));
	return lines.join("\n");
};

const runChange = async ({ ctx, ops }: { ctx: PageToolContext; ops: ChangeOp[] }): Promise<PageToolResult> => {
	const read = await readPageTree(ctx);
	if (!read.ok) return read.result;
	const applied = applyOps({ ctx, tree: read.blocks, ops });
	if (!applied.ok) return { ok: false, text: applied.text };

	const { before, after, patchOps, summary, touched } = applied.value;
	const committed = await commitTree({ ctx, before, after, ops: patchOps, summary, touched });
	if (!committed.ok) return { ok: false, text: committed.text };
	return { ok: true, text: describeCommit({ applied: applied.value, committed: committed.value }) };
};

/**
 * The `change_blocks` tool. Its input is checked against the shape inside `run`; a call
 * outside the selected block, over the limits, or leaving the page invalid changes nothing.
 * Calls run one after another, so two sent together never start from the same page.
 */
export const createChangeBlocksTool = ({ ctx, queue }: { ctx: PageToolContext; queue: SerialQueue }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "change_blocks",
			title: "Change blocks",
			description: DESCRIPTION,
			inputShape: changeBlocksShape,
			changesPage: true,
			run: ({ ops }) => queue(() => runChange({ ctx, ops })),
		},
	});
