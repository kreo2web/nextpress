const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const SAFE_SCHEMES = ["http", "https", "mailto"];

/**
 * A link an author wrote, kept only if it goes somewhere ordinary: `http(s):`, `mailto:`, a path
 * on this site or a `#` anchor. Anything else (`javascript:`, `data:`) is dropped, because a page
 * with many authors must never carry a link that runs code. Spaces and control characters are
 * ignored when reading the scheme, since browsers ignore them too (`java\tscript:`). Empty when unsafe.
 *
 * WHY here: the MDX views and the docs converter both need the same rule, and the converter must not
 * import a view file to get it.
 */
export const safeHref = (href: string | undefined): string => {
	const value = (href ?? "").trim();
	const compact = value.replace(/[\s\u0000-\u001f]/g, "");
	if (!compact || compact.startsWith("//")) return "";
	const scheme = SCHEME.exec(compact)?.[1]?.toLowerCase();
	return !scheme || SAFE_SCHEMES.includes(scheme) ? value : "";
};
