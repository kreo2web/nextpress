import type { BlockConfig } from "../schema-types.js";

/** True for a plain object (not null, not an array). The one guard for reading loose JSON. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A block's content as loose fields, or null when it has none. Widens the editor's content union so any field can be read. */
export const readContentRecord = (content: BlockConfig["content"]): Record<string, unknown> | null =>
	isRecord(content) ? content : null;
