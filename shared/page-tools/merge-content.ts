import type { BlockConfig } from "../schema-types.js";
import { isRecord, readContentRecord } from "./is-record.js";

type ContentFields = Record<string, unknown>;
type StyleFields = Record<string, string | number | null>;

export type MergeResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Lays `fields` over `base`; a `null` field removes that key. Top level only. */
const layerFields = ({ base, fields }: { base: ContentFields; fields: ContentFields }): ContentFields => {
	const merged: ContentFields = { ...base };
	for (const [key, value] of Object.entries(fields)) {
		if (value === null) delete merged[key];
		else merged[key] = value;
	}
	return merged;
};

/**
 * Lays an agent's content fields over a block's existing content, by the shape the block
 * stores:
 * - `structured` content keeps its fields under `data`, so the fields go into `data`
 * - text, media and other kinded content keeps them next to `kind`
 * - plain objects (`post/toc`, `post/info`, `post/progress`) are merged shallowly
 *
 * A `null` field removes that key. The block's `kind` can never change here: it decides how
 * the block is saved and drawn.
 */
export const mergeContentFields = ({
	base,
	fields,
}: {
	base: BlockConfig["content"];
	fields: ContentFields | undefined;
}): MergeResult<BlockConfig["content"]> => {
	if (!fields || Object.keys(fields).length === 0) return { ok: true, value: base };
	const baseFields = readContentRecord(base);
	const baseKind = typeof baseFields?.kind === "string" ? baseFields.kind : undefined;

	if (fields.kind !== undefined && fields.kind !== baseKind) {
		return {
			ok: false,
			message: `content.kind can't be changed (this block stores "${baseKind ?? "plain"}" content). Send only the fields to set, e.g. {"value": "..."}.`,
		};
	}
	const { kind: _kind, ...rest } = fields;

	if (!baseFields) return { ok: true, value: layerFields({ base: {}, fields: rest }) as BlockConfig["content"] };

	if (baseKind === "structured") {
		const data = isRecord(baseFields.data) ? baseFields.data : {};
		if (isRecord(rest.data) && !("data" in data)) {
			return {
				ok: false,
				message:
					'This block keeps its fields flat in content. Send {"gap": "1rem"}, not {"data": {"gap": "1rem"}}.',
			};
		}
		return {
			ok: true,
			value: { ...baseFields, kind: "structured", data: layerFields({ base: data, fields: rest }) } as BlockConfig["content"],
		};
	}

	return { ok: true, value: layerFields({ base: baseFields, fields: rest }) as BlockConfig["content"] };
};

/** Lays style fields over existing styles; a `null` field removes that style. */
export const mergeStyleFields = ({
	base,
	fields,
}: {
	base: BlockConfig["styles"];
	fields: StyleFields | undefined;
}): BlockConfig["styles"] => {
	if (!fields) return base;
	const merged: Record<string, string | number | null | undefined> = { ...(base as Record<string, string | number>) };
	for (const [key, value] of Object.entries(fields)) {
		if (value === null) delete merged[key];
		else merged[key] = value;
	}
	// Cast: the keys are the agent's CSS property names; the editor type is a closed CSS interface.
	return merged as BlockConfig["styles"];
};
