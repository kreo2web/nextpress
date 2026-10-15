export const DEFAULT_EXCERPT_MAX_LENGTH = 200;
export const DEFAULT_READ_MORE_TEXT = "Read More";

/**
 * Cut a teaser at a word, so the live page matches the editor slider.
 * Does not rewrite the stored excerpt.
 */
export function truncateExcerpt({
	text,
	maxLength,
}: {
	text: string;
	maxLength: number;
}): { truncated: string; wasTruncated: boolean } {
	const limit = Number.isFinite(maxLength) && maxLength > 0 ? maxLength : DEFAULT_EXCERPT_MAX_LENGTH;
	if (!text || text.length <= limit) {
		return { truncated: text || "", wasTruncated: false };
	}
	const sliced = text.slice(0, limit);
	const lastSpace = sliced.lastIndexOf(" ");
	const breakpoint = lastSpace > 0 ? lastSpace : limit;
	return { truncated: `${sliced.slice(0, breakpoint)}…`, wasTruncated: true };
}

export function readExcerptMaxLength(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: DEFAULT_EXCERPT_MAX_LENGTH;
}

export function readReadMoreText(value: unknown): string {
	return typeof value === "string" && value.trim() !== "" ? value : DEFAULT_READ_MORE_TEXT;
}
