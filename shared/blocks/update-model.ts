import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const UPDATE_BLOCK_NAME = "docs/update";

/**
 * One changelog entry: a label ("October 2026", "v1.4.2") and a short description, shown in a narrow
 * column beside the entry's content (its child blocks). The label is linkable from "On this page".
 * In MDX it is `<Update label="…" description="…">…</Update>`.
 */
export type UpdateContent = { label: string; description: string };

export const DEFAULT_UPDATE_CONTENT: UpdateContent = { label: "New entry", description: "" };

export function readUpdateContent(content: BlockContent | undefined): UpdateContent {
	const data = readStructuredData(content);
	return { label: readText(data.label), description: readText(data.description) };
}
