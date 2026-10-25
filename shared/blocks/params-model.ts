import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const PARAMS_BLOCK_NAME = "docs/params";

/** The most parameters one block lists; past this, split the list under headings. */
export const MAX_PARAMS = 50;

/** One documented option, prop or API field. `description` is markdown, drawn small. */
export type ParamItem = { name: string; type: string; default: string; required: boolean; description: string };

/** A list of parameters: name, type, default, whether it's required, and what it does. */
export type ParamsContent = { items: ParamItem[] };

export const DEFAULT_PARAMS_CONTENT: ParamsContent = {
	items: [
		{ name: "siteId", type: "string", default: "", required: true, description: "The site to read from." },
		{ name: "limit", type: "number", default: "20", required: false, description: "How many results to return, up to 100." },
	],
};

const readParam = (value: unknown): ParamItem | null => {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	// Kept as typed (a half-typed name or a space in a type must survive); the views trim and skip nameless rows.
	return {
		name: readText(item.name),
		type: readText(item.type),
		default: readText(item.default),
		required: item.required === true || item.required === "true",
		description: readText(item.description),
	};
};

/**
 * The parameters a reader sees: trimmed, rows without a name left out. The settings panel keeps
 * them as typed (a half-typed row must survive), so every view, the markdown copy and search use this.
 */
export const shownParams = (items: ParamItem[]): ParamItem[] =>
	items
		.map((item) => ({ ...item, name: item.name.trim(), type: item.type.trim(), default: item.default.trim(), description: item.description.trim() }))
		.filter((item) => item.name !== "");

export function readParamsContent(content: BlockContent | undefined): ParamsContent {
	const items = readStructuredData(content).items;
	if (!Array.isArray(items)) return { items: DEFAULT_PARAMS_CONTENT.items.map((item) => ({ ...item })) };
	return { items: items.map(readParam).filter((item): item is ParamItem => item !== null).slice(0, MAX_PARAMS) };
}
