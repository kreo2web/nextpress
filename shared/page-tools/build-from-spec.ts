import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import type { BlockConfig } from "../schema-types.js";
import { isRecord } from "./is-record.js";
import { type MergeResult, mergeContentFields, mergeStyleFields } from "./merge-content.js";
import type { BlockSpec } from "./types.js";

export type BuildFromSpecParams = {
	spec: BlockSpec;
	/** The block this one will sit in, or null for the page root. */
	parentId: string | null;
	/** Makes every id: the block's own, its starting children's and its specified children's. */
	newId: () => string;
};

type BuildNodeParams = BuildFromSpecParams & { where: string };

const unknownNameMessage = (name: string, where: string): string =>
	`${where}: unknown block name "${name}". Call list_block_types for the valid names.`;

const buildNode = ({ spec, parentId, newId, where }: BuildNodeParams): MergeResult<BlockConfig> => {
	const id = newId();
	// When the spec lists its own children they replace the starting ones, so those ids are never used.
	const base = createDefaultBlock({ name: spec.name, id, newId: spec.children ? () => id : newId });
	if (!base) return { ok: false, message: unknownNameMessage(String(spec.name), where) };

	if (spec.content !== undefined && !isRecord(spec.content)) {
		return { ok: false, message: `${where}: content must be an object of fields, e.g. {"value": "..."}.` };
	}
	const content = mergeContentFields({ base: base.content, fields: spec.content });
	if (!content.ok) return { ok: false, message: `${where}: ${content.message}` };

	const block: BlockConfig = {
		...base,
		parentId,
		content: content.value,
		styles: mergeStyleFields({ base: base.styles, fields: spec.styles }),
		...(spec.label !== undefined ? { label: spec.label } : {}),
	};

	if (spec.children === undefined) return { ok: true, value: block };

	if (base.type !== "container") {
		if (spec.children.length === 0) return { ok: true, value: block };
		return {
			ok: false,
			message: `${where}: ${spec.name} can't hold other blocks, so it can't have children. Put them in a container such as core/stack.`,
		};
	}
	const children: BlockConfig[] = [];
	for (const [index, childSpec] of spec.children.entries()) {
		const child = buildNode({ spec: childSpec, parentId: id, newId, where: `${where} > children[${index}]` });
		if (!child.ok) return child;
		children.push(child.value);
	}
	return { ok: true, value: { ...block, children } };
};

/**
 * Turns a block described by an agent into a real block, exactly as the editor would insert
 * it: catalog defaults first, then the spec's content and styles laid over them.
 *
 * - `content` merges by the block's shape (see `mergeContentFields`); a `null` removes a default.
 * - `styles` merge over the default styles; a `null` removes one.
 * - `children`, when given, replace the starting children; without it the starting children
 *   (an accordion's first items, a form's fields) stay. Only containers can have children.
 *
 * WHY a result and not a throw: a wrong name or shape is the agent's mistake, and the message
 * goes straight back to it so it can correct itself.
 */
export const buildBlockFromSpec = ({ spec, parentId, newId }: BuildFromSpecParams): MergeResult<BlockConfig> =>
	buildNode({ spec, parentId, newId, where: spec.name });
