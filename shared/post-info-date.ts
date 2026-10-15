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

/** Same date words on the canvas and the published page. */
export function formatPostInfoDate(isoDate: string, format: PostInfoDateFormat): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) return "Invalid date";
	if (format === "relative") return formatRelativeTime(date);
	const month = format === "short" ? "short" : "long";
	return date.toLocaleDateString("en-US", {
		month,
		day: "numeric",
		year: "numeric",
	});
}

export function readPostInfoDateFormat(value: unknown): PostInfoDateFormat {
	if (value === "short" || value === "long" || value === "relative") return value;
	return "long";
}
