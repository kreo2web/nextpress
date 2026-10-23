import type { BlockContent } from "../schema-types.js";

/** A structured block's fields (`content.data`), or none. Every block model here reads through it. */
export const readStructuredData = (content: BlockContent | undefined): Record<string, unknown> => {
	if (!content || typeof content !== "object" || !("kind" in content) || content.kind !== "structured") return {};
	const data = (content as { data?: unknown }).data;
	return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
};

/** One of the allowed words, or the fallback. */
export const readChoice = <T extends string>({ value, options, fallback }: { value: unknown; options: readonly T[]; fallback: T }): T =>
	options.find((option) => option === value) ?? fallback;

/** A whole number kept between `min` and `max`, or the fallback when it isn't a number. */
export const readCount = ({ value, min, max, fallback }: { value: unknown; min: number; max: number; fallback: number }): number => {
	const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export const readText = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
