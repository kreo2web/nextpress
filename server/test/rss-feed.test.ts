import { describe, expect, it } from "vitest";
import { buildRssFeed } from "../lib/feed/build-rss-feed";

describe("RSS feed", () => {
	it("lists posts at their public address with escaped text", () => {
		const xml = buildRssFeed({
			site: { name: "Tom & Jerry's", url: "https://example.com/", description: "A <site>" },
			posts: [{ id: "p1", title: "Hello <world>", slug: "hello world", excerpt: "Fish & chips", publishedAt: "2026-10-01T10:00:00Z", createdAt: null }],
		});
		expect(xml).toContain("<title>Tom &amp; Jerry&apos;s</title>");
		expect(xml).toContain("<link>https://example.com/post/hello%20world</link>");
		expect(xml).toContain("<title>Hello &lt;world&gt;</title>");
		expect(xml).toContain("<description>Fish &amp; chips</description>");
		expect(xml).toContain("<pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate>");
		expect(xml).toContain('href="https://example.com/feed"');
	});

	it("is a valid empty channel when there are no posts", () => {
		const xml = buildRssFeed({ site: { name: "Empty", url: "https://e.com", description: "" }, posts: [] });
		expect(xml).toMatch(/<channel>[\s\S]*<\/channel>/);
		expect(xml).not.toContain("<item>");
	});
});
