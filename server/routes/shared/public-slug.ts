/**
 * Single-segment addresses that are not a published page.
 * `/admin` and friends must fall through to the app. A dotted name is a file.
 */
const RESERVED_PUBLIC_SLUGS = new Set([
	"admin",
	"api",
	"assets",
	"favicon.ico",
	"home",
	"index.html",
	"page",
	"pages",
	"post",
	"posts",
	"preview",
	"renderer",
	"robots.txt",
	"setup",
	"sites",
	"sitemap.xml",
	"src",
	"uploads",
	"vendor",
]);

export function isReservedPublicSlug(slug: string): boolean {
	const name = slug.trim().toLowerCase();
	if (!name || name.includes(".")) return true;
	return RESERVED_PUBLIC_SLUGS.has(name);
}

/** Tool and build folders that are never a page's parent, so their files skip the page lookup. */
const NON_PAGE_FIRST_SEGMENTS = new Set(["node_modules"]);

/**
 * Multi-word addresses (`/guides/install`) that are not a page. The first word must not be a
 * reserved one, so `/admin/...`, `/api/...`, `/vendor/...`, `/uploads/...` and the other fixed
 * addresses always win. Any dotted word is a file (`/guides/logo.png`). Later words are free, so
 * a child page may be called `post` or `home`.
 */
export function isReservedPublicPath(path: string): boolean {
	const words = path.split("/").filter((word) => word !== "");
	if (words.length === 0) return true;
	const first = words[0].toLowerCase();
	if (isReservedPublicSlug(first) || first.startsWith("@") || NON_PAGE_FIRST_SEGMENTS.has(first)) return true;
	return words.some((word) => word.includes("."));
}
