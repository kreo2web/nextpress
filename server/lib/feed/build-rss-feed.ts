/** One post as the feed lists it. */
export type FeedPost = {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	publishedAt: Date | string | null;
	createdAt: Date | string | null;
};

export type FeedSite = { name: string; url: string; description: string };

/** Text made safe inside XML, for the feed and the sitemap. */
export const escapeXml = (value: string): string =>
	value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);

const rfc822 = (value: Date | string | null): string | null => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toUTCString();
};

/**
 * An RSS 2.0 feed of a site's newest published posts. Pure: the route picks the posts (published,
 * not password-protected, this site only) and the count from Settings → Reading.
 */
export function buildRssFeed({ site, posts }: { site: FeedSite; posts: FeedPost[] }): string {
	const base = site.url.replace(/\/+$/, "");
	const items = posts
		.map((post) => {
			const link = `${base}/post/${encodeURIComponent(post.slug)}`;
			const date = rfc822(post.publishedAt ?? post.createdAt);
			return [
				"    <item>",
				`      <title>${escapeXml(post.title)}</title>`,
				`      <link>${escapeXml(link)}</link>`,
				`      <guid isPermaLink="false">${escapeXml(post.id)}</guid>`,
				date ? `      <pubDate>${date}</pubDate>` : null,
				post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : null,
				"    </item>",
			]
				.filter((line): line is string => line !== null)
				.join("\n");
		})
		.join("\n");

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		"  <channel>",
		`    <title>${escapeXml(site.name)}</title>`,
		`    <link>${escapeXml(base || "/")}</link>`,
		`    <description>${escapeXml(site.description)}</description>`,
		`    <atom:link href="${escapeXml(`${base}/feed`)}" rel="self" type="application/rss+xml" />`,
		items,
		"  </channel>",
		"</rss>",
		"",
	]
		.filter((line) => line !== "")
		.join("\n");
}
