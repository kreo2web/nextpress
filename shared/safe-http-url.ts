/** True for an http(s) URL we can put on a published link. */
export function isSafeHttpUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	try {
		const parsed = new URL(trimmed);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/** Turn a site field into an http(s) URL, or empty when it is not safe. */
export function normalizeWebsiteUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: trimmed.includes(".") && !trimmed.includes(" ")
			? `https://${trimmed}`
			: trimmed;
	return isSafeHttpUrl(withProtocol) ? withProtocol : "";
}

/** Turn an X/Twitter field (@name, name, or URL) into an http(s) profile URL. */
export function normalizeXProfileUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("@")) {
		const handle = trimmed.slice(1).replace(/[^A-Za-z0-9_]/g, "");
		return handle ? `https://x.com/${handle}` : "";
	}
	if (/^[A-Za-z0-9_]{1,15}$/.test(trimmed)) {
		return `https://x.com/${trimmed}`;
	}
	return normalizeWebsiteUrl(trimmed);
}
