import type { BlockContent } from "../schema-types.js";

/**
 * Stored shape for blocks whose editor model is a plain object. Matches the
 * editor's default serialize (`createBlockDefinition`), so editor and catalog agree.
 */
export const structured = (data: Record<string, unknown>): BlockContent => ({
	kind: "structured",
	data: structuredClone(data),
});

/** A fresh copy of a default that already carries its `kind` (text, media, …). */
export const fresh = <T extends object>(content: T): BlockContent =>
	structuredClone(content) as BlockContent;

/** The `other` every new block starts with: no colour tokens, the editor's default units. */
export const newBlockOther = () => ({
	tokenMap: {},
	units: { spacing: "px", font: "rem", dimension: "px", border: "px" },
});
