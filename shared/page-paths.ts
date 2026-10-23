/** The least a page must tell us to work out its address. */
export type PagePathInput = { id: string; slug: string; parentId?: string | null };

/** The most levels a page address can have. A longer chain falls back to the page's own slug. */
const MAX_DEPTH = 12;

/** `/Guides//install/` becomes `guides/install`: no outer or doubled slashes, no query or hash. */
export function normalizePagePath(path: string): string {
	return path
		.split(/[?#]/)[0]
		.split("/")
		.filter((part) => part.trim() !== "")
		.join("/");
}

/**
 * Every page's address without the leading slash: its parents' slugs, then its own
 * (`guides/install`). Top-level pages are just their slug. If the chain loops, is too deep or a
 * parent is missing from the list, that page falls back to its own slug so a bad link never
 * breaks the page itself.
 *
 * Give this ALL of a site's pages (drafts too): a draft parent still shows in its child's address.
 */
export function buildPagePaths(pages: PagePathInput[]): Map<string, string> {
	const byId = new Map(pages.map((page) => [page.id, page]));
	const pathOf = (page: PagePathInput): string => {
		const slugs = [page.slug];
		const seen = new Set([page.id]);
		let parentId = page.parentId ?? null;
		while (parentId) {
			const parent = byId.get(parentId);
			if (!parent || seen.has(parent.id) || slugs.length >= MAX_DEPTH) return page.slug;
			seen.add(parent.id);
			slugs.unshift(parent.slug);
			parentId = parent.parentId ?? null;
		}
		return slugs.join("/");
	};
	return new Map(pages.map((page) => [page.id, pathOf(page)]));
}

/**
 * The page at an address. A full address (`guides/install`) must match exactly. A single word
 * also finds a nested page by its own slug, so links and menus made before pages had parents keep
 * working. Slugs are unique per site, so the flat match is never ambiguous.
 */
export function resolvePagePath<T extends PagePathInput>({ pages, path }: { pages: T[]; path: string }): T | null {
	const wanted = normalizePagePath(path);
	if (!wanted) return null;
	const paths = buildPagePaths(pages);
	const exact = pages.find((page) => paths.get(page.id) === wanted);
	if (exact) return exact;
	if (wanted.includes("/")) return null;
	return pages.find((page) => page.slug === wanted) ?? null;
}
