import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData } from "./read-structured.js";

export const CODE_EXAMPLE_BLOCK_NAME = "docs/example";

export const CODE_EXAMPLE_LAYOUTS = ["side", "stacked"] as const;
export type CodeExampleLayout = (typeof CODE_EXAMPLE_LAYOUTS)[number];

/**
 * Code beside what it makes. The first child is a `core/code`; the other children are the result,
 * built from ordinary blocks. Nothing runs: the result is whatever the author put there. Side by
 * side on wide screens, always stacked on phones.
 */
export type CodeExampleContent = { layout: CodeExampleLayout };

export const DEFAULT_CODE_EXAMPLE_CONTENT: CodeExampleContent = { layout: "side" };

export function readCodeExampleContent(content: BlockContent | undefined): CodeExampleContent {
	return { layout: readChoice({ value: readStructuredData(content).layout, options: CODE_EXAMPLE_LAYOUTS, fallback: "side" }) };
}
