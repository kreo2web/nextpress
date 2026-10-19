export type PostInfoDateFormat = "short" | "long" | "relative";

function formatRelativeTime(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffMinutes = Math.floor(diffMs / 60_000);
	if (diffDays >= 365) return `${Math.floor(diffDays / 365)} year${diffDays >= 730 ? "s" : ""} ago`;
	if (diffDays >= 30) return `${Math.floor(diffDays / 30)} month${diffDays >= 60 ? "s" : ""} ago`;
	if (diffDays >= 7) return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? "s" : ""} ago`;
	if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
	return "just now";
}

/** A timezone the runtime knows, else undefined (the reader's own zone), so a bad stored value never throws. */
export const readTimeZone = (value: unknown): string | undefined => {
	if (typeof value !== "string" || value === "") return undefined;
	return value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value) ? value : undefined;
};

/**
 * Same date words on the canvas and the published page. `timeZone` is the site's (Settings →
 * General), so a post dated late at night shows the same day to every visitor.
 */
export function formatPostInfoDate(isoDate: string, format: PostInfoDateFormat, timeZone?: string): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) return "Invalid date";
	if (format === "relative") return formatRelativeTime(date);
	const month = format === "short" ? "short" : "long";
	return date.toLocaleDateString("en-US", {
		month,
		day: "numeric",
		year: "numeric",
		timeZone: readTimeZone(timeZone),
	});
}

/** The short date a post list shows ("Oct 19, 2026"), in the site's timezone. */
export function formatPostListDate(isoDate: string, timeZone?: string): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: readTimeZone(timeZone) });
}

export function readPostInfoDateFormat(value: unknown): PostInfoDateFormat {
	if (value === "short" || value === "long" || value === "relative") return value;
	return "long";
}
