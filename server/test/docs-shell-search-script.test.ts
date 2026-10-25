import { describe, expect, it } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { buildPublishedPageHtml } from "../routes/shared/build-published-page-html";

const shell = (data: object): BlockConfig =>
	({ id: "s", name: "docs/shell", type: "container", parentId: null, label: "Docs shell", category: "docs", content: { kind: "structured", data }, styles: {}, settings: {}, children: [] }) as BlockConfig;

const htmlFor = (blocks: BlockConfig[]): string =>
	buildPublishedPageHtml({
		page: { id: "p", title: "Doc", slug: "doc", blocks, other: { seo: {}, design: {} } } as Parameters<typeof buildPublishedPageHtml>[0]["page"],
		canonicalUrl: "http://localhost:5000/doc",
	});

describe("search script on docs pages", () => {
	it("loads for a docs shell with search shown (the default)", () => {
		expect(htmlFor([shell({})])).toContain('<script src="/vendor/search.js"></script>');
	});
	it("is left out when the shell hides search, and for pages without a shell", () => {
		expect(htmlFor([shell({ search: { show: false, label: "Search", placeholder: "" } })])).not.toContain("/vendor/search.js");
		expect(htmlFor([])).not.toContain("/vendor/search.js");
	});
	it("uses the settings in force after inheritance when the page was bound", () => {
		const bound = shell({ inherit: true, search: { show: true, label: "Search", placeholder: "" }, docsShell: { settings: { search: { show: false, label: "x", placeholder: "" } }, source: { kind: "own" }, tree: [] } });
		expect(htmlFor([bound])).not.toContain("/vendor/search.js");
	});
});
