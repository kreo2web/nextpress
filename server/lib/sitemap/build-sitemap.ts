import { parsePageOther } from "@shared/page-other";
import { escapeXml } from "../feed/build-rss-feed";
import { isPubliclyReadable } from "../is-publicly-readable";

/** One address in the sitemap: where it lives on the site and when it last changed. */
export type SitemapEntry = { path: string; lastModified: Date | string | null };

/** What the sitemap needs from a page or a post. */
type ListableDocument = {
	id: string;
	slug: string | null;
	status?: string | null;
	password?: string | null;
	other?: unknown;
	updatedAt?: Date | string | null;
};

/** Visitors can open it, and its owner didn't ask search engines to leave it out. */
const isListable = (document: ListableDocument): boolean =>
	isPubliclyReadable(document) && typeof document.slug === "string" && parsePageOther(document.other).seo?.noIndex !== true;

/** Dates as the sitemap wants them (`2026-10-23`), or nothing when the date is missing or bad. */
const sitemapDate = (value: Date | string | null): string | null => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

/**
 * The addresses a site's sitemap lists: its home, every page visitors can open (at its nested
 * address, from `paths`) and every post. The homepage's own page is listed once, as `/`.
 */
export function collectSitemapEntries({
	pages,
	paths,
	homepageSlug,
	posts,
}: {
	pages: ListableDocument[];
	paths: Map<string, string>;
	homepageSlug: string | null;
	posts: ListableDocument[];
}): SitemapEntry[] {
	const homepage = homepageSlug ? pages.find((page) => page.slug === homepageSlug && isListable(page)) : undefined;
	const pageEntries = pages
		.filter((page) => isListable(page) && page.id !== homepage?.id)
		.map((page) => ({ path: `/${paths.get(page.id) ?? page.slug}`, lastModified: page.updatedAt ?? null }));
	const postEntries = posts
		.filter(isListable)
		.map((post) => ({ path: `/post/${encodeURIComponent(String(post.slug))}`, lastModified: post.updatedAt ?? null }));
	return [{ path: "/", lastModified: homepage?.updatedAt ?? null }, ...pageEntries, ...postEntries];
}

/**
 * A sitemap (sitemaps.org 0.9) for search engines. Pure: the route decides what goes in.
 * `baseUrl` has no trailing slash; each entry's path starts with "/".
 */
export function buildSitemap({ baseUrl, entries }: { baseUrl: string; entries: SitemapEntry[] }): string {
	const urls = entries.map((entry) => {
		const lastModified = sitemapDate(entry.lastModified);
		return [
			"  <url>",
			`    <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>`,
			lastModified ? `    <lastmod>${lastModified}</lastmod>` : "",
			"  </url>",
		]
			.filter(Boolean)
			.join("\n");
	});
	return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, "</urlset>", ""].join("\n");
}
