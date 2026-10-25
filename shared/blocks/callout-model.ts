import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const CALLOUT_BLOCK_NAME = "docs/callout";

export const CALLOUT_TYPES = ["note", "tip", "warning", "danger", "success"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** Any other value an author types is shown as a note. */
export const readCalloutType = (value: unknown): CalloutType => readChoice({ value, options: CALLOUT_TYPES, fallback: "note" });

/**
 * A highlighted note around other blocks. The same look as `<Callout>` in MDX
 * (`shared/markdown/callout.tsx`), which the published view and the editor both use.
 */
export type CalloutContent = {
	type: CalloutType;
	/** Optional bold line above the text. */
	title: string;
};

export const DEFAULT_CALLOUT_CONTENT: CalloutContent = { type: "note", title: "" };

export function readCalloutContent(content: BlockContent | undefined): CalloutContent {
	const data = readStructuredData(content);
	return { type: readCalloutType(data.type), title: readText(data.title) };
}
