import type { BlockConfig } from "@shared/schema-types";

/**
 * The blocks a template row stores, as a list. The column is untyped JSON, so anything that is not
 * a list reads as empty rather than breaking the canvas.
 */
export const readTemplateBlocks = (blocks: unknown): BlockConfig[] =>
	Array.isArray(blocks) ? (blocks as BlockConfig[]) : [];
