import type { BlockContent } from "../schema-types.js";
import { readStructuredData } from "./read-structured.js";

/** Anything JSON can hold: what block content looks like once it has been saved and read back. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** A structured block's saved fields as JSON. Saved content is JSON, so the shared reader's loose type narrows safely. */
export const readJsonData = (content: BlockContent | undefined): JsonObject => readStructuredData(content) as JsonObject;

export const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);
