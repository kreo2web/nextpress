import { describe, expect, it } from "vitest";
import { buildPagePaths, normalizePagePath, pagePathInputOf, resolvePagePath } from "./page-paths";

const page = (id: string, slug: string, parentId: string | null = null) => ({ id, slug, parentId });

const pages = [page("g", "guides"), page("i", "install", "g"), page("d", "docker", "i"), page("a", "about")];

describe("buildPagePaths", () => {
	it("leaves top-level pages as their slug", () => {
		expect(buildPagePaths(pages).get("a")).toBe("about");
	});

	it("puts parents first, however deep", () => {
		const paths = buildPagePaths(pages);
		expect(paths.get("i")).toBe("guides/install");
		expect(paths.get("d")).toBe("guides/install/docker");
	});

	it("falls back to the slug when the parent is missing", () => {
		expect(buildPagePaths([page("x", "orphan", "gone")]).get("x")).toBe("orphan");
	});

	it("falls back to the slug when parents loop", () => {
		const paths = buildPagePaths([page("a", "a", "b"), page("b", "b", "a"), page("s", "self", "s")]);
		expect(paths.get("a")).toBe("a");
		expect(paths.get("b")).toBe("b");
		expect(paths.get("s")).toBe("self");
	});

	it("falls back to the slug when the chain is absurdly deep", () => {
		const chain = Array.from({ length: 30 }, (_, n) => page(`p${n}`, `s${n}`, n === 0 ? null : `p${n - 1}`));
		expect(buildPagePaths(chain).get("p29")).toBe("s29");
		expect(buildPagePaths(chain).get("p5")).toBe("s0/s1/s2/s3/s4/s5");
	});
});

describe("resolvePagePath", () => {
	it("finds a nested page by its full address", () => {
		expect(resolvePagePath({ pages, path: "/guides/install" })?.id).toBe("i");
		expect(resolvePagePath({ pages, path: "guides/install/docker/" })?.id).toBe("d");
	});

	it("still finds a nested page by its own slug", () => {
		expect(resolvePagePath({ pages, path: "install" })?.id).toBe("i");
	});

	it("finds top-level pages", () => {
		expect(resolvePagePath({ pages, path: "about" })?.id).toBe("a");
	});

	it("does not find a wrong or partial parent chain", () => {
		expect(resolvePagePath({ pages, path: "about/install" })).toBeNull();
		expect(resolvePagePath({ pages, path: "install/docker" })).toBeNull();
		expect(resolvePagePath({ pages, path: "guides/docker" })).toBeNull();
	});

	it("returns null for an empty path or an unknown page", () => {
		expect(resolvePagePath({ pages, path: "/" })).toBeNull();
		expect(resolvePagePath({ pages, path: "nope" })).toBeNull();
	});

	it("keeps a looping page reachable by its slug", () => {
		const looped = [page("a", "a", "b"), page("b", "b", "a")];
		expect(resolvePagePath({ pages: looped, path: "a" })?.id).toBe("a");
	});
});

describe("docs on an address of their own", () => {
	// docs.example.com: the docs home is the site's homepage, so its pages start at the site root.
	const own = [{ ...page("h", "docs"), addressRoot: true }, page("gs", "getting-started", "h"), page("in", "install", "gs"), page("faq", "faq", "h")];

	it("leaves the home's part out of the addresses under it, and keeps the home's own", () => {
		const paths = buildPagePaths(own);
		expect(paths.get("in")).toBe("getting-started/install");
		expect(paths.get("faq")).toBe("faq");
		expect(paths.get("h")).toBe("docs");
	});

	it("finds pages by the new address, by the address they had before, and by their own slug", () => {
		expect(resolvePagePath({ pages: own, path: "getting-started/install" })?.id).toBe("in");
		expect(resolvePagePath({ pages: own, path: "/docs/getting-started/install" })?.id).toBe("in");
		expect(resolvePagePath({ pages: own, path: "install" })?.id).toBe("in");
		expect(resolvePagePath({ pages: own, path: "docs/install" })).toBeNull();
	});

	it("changes nothing for a site without such a docs", () => {
		expect(buildPagePaths(pages)).toEqual(buildPagePaths(pages, { withRoots: false }));
	});

	it("reads the flag from the page's extras", () => {
		expect(pagePathInputOf({ id: "h", slug: "docs", parentId: null, other: { docs: { ownAddress: true } } })).toEqual({ id: "h", slug: "docs", parentId: null, addressRoot: true });
		expect(pagePathInputOf({ id: "p", slug: "page", parentId: null, other: { docs: { hidden: true } } })).toEqual({ id: "p", slug: "page", parentId: null });
		expect(pagePathInputOf({ id: "q", slug: "page", other: null })).not.toHaveProperty("addressRoot");
	});
});

describe("normalizePagePath", () => {
	it("drops slashes, query and hash", () => {
		expect(normalizePagePath("//guides//install/?x=1#top")).toBe("guides/install");
	});
});
