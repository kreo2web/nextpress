import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import type { BlockConfig } from "../schema-types.js";
import { explainUnknownContentFields } from "./content-fields.js";
import { layoutEqualColumns } from "./equal-columns.js";
import { withFillBehind } from "./fill-behind.js";
import { withInlineHtmlFormat } from "./inline-html.js";
import { isRecord } from "./is-record.js";
import { type MergeResult, mergeContentFields, mergeStyleFields } from "./merge-content.js";
import type { BlockSpec } from "./types.js";

export type BuildFromSpecParams = {
	spec: BlockSpec;
	/** The block this one will sit in, or null for the page root. */
	parentId: string | null;
	/** That block itself, when the caller has it. Needed only to check `fillBehind`. */
	parent?: BlockConfig | null;
	/** Makes every id: the block's own, its starting children's and its specified children's. */
	newId: () => string;
};

type BuildNodeParams = BuildFromSpecParams & { where: string };

const unknownNameMessage = (name: string, where: string): string =>
	`${where}: unknown block name "${name}". Call list_block_types for the valid names.`;

/**
 * Columns keeps which child sits in which column in `settings.columnLayout`, by child id. An agent
 * can't know ids it hasn't made yet, so a Columns block built with children gets one equal column
 * per child, the same split the editor makes when you pick a column count.
 */
const withColumnPerChild = ({ block, newId }: { block: BlockConfig; newId: () => string }): BlockConfig => {
	const children = block.children ?? [];
	if (block.name !== "core/columns" || children.length === 0) return block;
	const columnLayout = layoutEqualColumns({ groups: children.map((child) => [child.id]), newId });
	return { ...block, settings: { ...block.settings, columnLayout } };
};

const buildNode = ({ spec, parentId, parent, newId, where }: BuildNodeParams): MergeResult<BlockConfig> => {
	const id = newId();
	// When the spec lists its own children they replace the starting ones, so those ids are never used.
	const base = createDefaultBlock({ name: spec.name, id, newId: spec.children ? () => id : newId });
	if (!base) return { ok: false, message: unknownNameMessage(String(spec.name), where) };

	if (spec.content !== undefined && !isRecord(spec.content)) {
		return { ok: false, message: `${where}: content must be an object of fields, e.g. {"value": "..."}.` };
	}
	const unknownFields = explainUnknownContentFields({ name: spec.name, fields: spec.content });
	if (unknownFields) return { ok: false, message: `${where}: ${unknownFields}` };
	const content = mergeContentFields({ base: base.content, fields: withInlineHtmlFormat({ name: spec.name, fields: spec.content }) });
	if (!content.ok) return { ok: false, message: `${where}: ${content.message}` };

	const settings = withFillBehind({ settings: base.settings, parent, fillBehind: spec.fillBehind });
	if (!settings.ok) return { ok: false, message: `${where}: ${settings.message}` };

	const block: BlockConfig = {
		...base,
		parentId,
		content: content.value,
		styles: mergeStyleFields({ base: base.styles, fields: spec.styles }),
		...(settings.value !== undefined ? { settings: settings.value } : {}),
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
		const child = buildNode({ spec: childSpec, parentId: id, parent: block, newId, where: `${where} > children[${index}]` });
		if (!child.ok) return child;
		children.push(child.value);
	}
	return { ok: true, value: withColumnPerChild({ block: { ...block, children }, newId }) };
};

/**
 * Turns a block described by an agent into a real block, exactly as the editor would insert
 * it: catalog defaults first, then the spec's content and styles laid over them.
 *
 * - `content` merges by the block's shape (see `mergeContentFields`); a `null` removes a default.
 *   A field the block doesn't have is refused, with a guess at what was meant.
 * - `styles` merge over the default styles; a `null` removes one.
 * - `children`, when given, replace the starting children; without it the starting children
 *   (an accordion's first items, a form's fields) stay. Only containers can have children.
 *   Columns given children gets one equal column per child.
 * - `fillBehind` marks a layer of an overlay Stack as filling behind the others.
 * - `ref` is not saved; `change_blocks` reads it to find the new block in later ops.
 *
 * WHY a result and not a throw: a wrong name or shape is the agent's mistake, and the message
 * goes straight back to it so it can correct itself.
 */
export const buildBlockFromSpec = ({ spec, parentId, parent, newId }: BuildFromSpecParams): MergeResult<BlockConfig> =>
	buildNode({ spec, parentId, parent, newId, where: spec.name });
