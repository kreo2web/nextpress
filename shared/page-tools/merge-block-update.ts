import type { BlockConfig } from "../schema-types.js";
import { type MergeResult, mergeContentFields, mergeStyleFields } from "./merge-content.js";
import type { BlockPatchOp } from "./types.js";

type UpdatePatchOp = Extract<BlockPatchOp, { op: "update" }>;

/**
 * The tool-level update: only the fields the agent names change, the rest of the block
 * stays. Content fields merge into the block's content by its shape, styles merge into its
 * styles, and a `null` removes that key. Returns the full `update` op (with the merged
 * content and styles written out) that `patchBlockTree` applies.
 *
 * WHY merge here: a plain patch `update` replaces content and styles whole, which would
 * force an agent to resend every field of a block just to change one.
 */
export const mergeBlockUpdate = ({
	block,
	label,
	content,
	styles,
}: {
	block: BlockConfig;
	label?: string;
	content?: Record<string, unknown>;
	styles?: Record<string, string | number | null>;
}): MergeResult<UpdatePatchOp> => {
	if (label === undefined && content === undefined && styles === undefined) {
		return { ok: false, message: `Nothing to change on ${block.id}: send label, content or styles.` };
	}
	const set: UpdatePatchOp["set"] = {};
	if (label !== undefined) set.label = label;
	if (content !== undefined) {
		const merged = mergeContentFields({ base: block.content, fields: content });
		if (!merged.ok) return { ok: false, message: `${block.id} (${block.name}): ${merged.message}` };
		set.content = merged.value;
	}
	if (styles !== undefined) set.styles = mergeStyleFields({ base: block.styles, fields: styles });
	return { ok: true, value: { op: "update", id: block.id, set } };
};
