import { parsePageOther } from "./page-other.js";

/** The least a page must tell us to work out its address. */
export type PagePathInput = {
	id: string;
	slug: string;
	parentId?: string | null;
	/** Pages under it leave its slug out of their addresses: docs on an address of their own (`page.other.docs.ownAddress`). */
	addressRoot?: boolean;
};

/** A stored page as the address builder takes it, with `addressRoot` read from its extras. */
export const pagePathInputOf = ({ id, slug, parentId, other }: { id: string; slug: string; parentId?: string | null; other?: Parameters<typeof parsePageOther>[0] }): PagePathInput => ({
	id,
	slug,
	parentId,
	...(parsePageOther(other).docs?.ownAddress === true ? { addressRoot: true } : {}),
});

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
 * (`guides/install`). Top-level pages are just their slug. A parent marked `addressRoot` ends the
 * address there, its own slug left out (`install` under a docs on its own address). If the chain
 * loops, is too deep or a parent is missing from the list, that page falls back to its own slug so
 * a bad link never breaks the page itself.
 *
 * Give this ALL of a site's pages (drafts too): a draft parent still shows in its child's address.
 * `withRoots: false` gives the addresses as they were before roots, so older links still resolve.
 */
export function buildPagePaths(pages: PagePathInput[], { withRoots = true }: { withRoots?: boolean } = {}): Map<string, string> {
	const byId = new Map(pages.map((page) => [page.id, page]));
	const pathOf = (page: PagePathInput): string => {
		const slugs = [page.slug];
		const seen = new Set([page.id]);
		let parentId = page.parentId ?? null;
		while (parentId) {
			const parent = byId.get(parentId);
			if (!parent || seen.has(parent.id) || slugs.length >= MAX_DEPTH) return page.slug;
			if (withRoots && parent.addressRoot) break;
			seen.add(parent.id);
			slugs.unshift(parent.slug);
			parentId = parent.parentId ?? null;
		}
		return slugs.join("/");
	};
	return new Map(pages.map((page) => [page.id, pathOf(page)]));
}

/**
 * The page at an address. A full address (`guides/install`) must match exactly, as it is now or as
 * it was before its docs moved to an address of its own (`docs/guides/install`). A single word
 * also finds a nested page by its own slug, so links and menus made before pages had parents keep
 * working. Slugs are unique per site, so the flat match is never ambiguous.
 */
export function resolvePagePath<T extends PagePathInput>({ pages, path }: { pages: T[]; path: string }): T | null {
	const wanted = normalizePagePath(path);
	if (!wanted) return null;
	const paths = buildPagePaths(pages);
	const exact = pages.find((page) => paths.get(page.id) === wanted);
	if (exact) return exact;
	const before = buildPagePaths(pages, { withRoots: false });
	const older = pages.find((page) => before.get(page.id) === wanted);
	if (older) return older;
	if (wanted.includes("/")) return null;
	return pages.find((page) => page.slug === wanted) ?? null;
}
