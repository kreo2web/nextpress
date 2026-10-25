/** `W/"abc"` and `"abc"` name the same copy for this check, so the weak mark is ignored. */
const bare = (tag: string): string => tag.trim().replace(/^W\//, "");

/**
 * Whether the browser's `If-None-Match` header names the copy we would send. When it does, the
 * answer is 304 with no body. A lone `*` means "any copy", and a header may list several.
 */
export const matchesIfNoneMatch = ({ header, etag }: { header: string | undefined; etag: string }): boolean => {
	if (!header) return false;
	if (header.trim() === "*") return true;
	return header.split(",").some((tag) => bare(tag) === bare(etag));
};
