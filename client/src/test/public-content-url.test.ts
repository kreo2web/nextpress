import { describe, expect, it } from "vitest";
import { buildPublicContentUrl } from "@/lib/site-api";

const site = { id: "s1", siteUrl: "https://docs.example.com/", isDefault: false };

describe("buildPublicContentUrl for nested pages", () => {
	it("uses the full address when given, one slash between words", () => {
		expect(buildPublicContentUrl({ site, slug: "install", kind: "page", pagePath: "guides/install" })).toBe("https://docs.example.com/guides/install");
	});

	it("uses the slug when there is no full address, and leaves top-level pages and posts alone", () => {
		expect(buildPublicContentUrl({ site, slug: "about", kind: "page" })).toBe("https://docs.example.com/about");
		expect(buildPublicContentUrl({ site, slug: "hello", kind: "post", pagePath: "x/hello" })).toBe("https://docs.example.com/post/hello");
	});

	it("keeps the slug address for a site with no address of its own", () => {
		expect(buildPublicContentUrl({ site: { ...site, siteUrl: "" }, slug: "install", kind: "page", pagePath: "guides/install" })).toBe("/sites/s1/install");
	});
});
