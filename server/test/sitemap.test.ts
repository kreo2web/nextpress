import { AddressInfo } from "node:net";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { Deps } from "../routes/shared/deps";
import { createSitemapRoutes } from "../routes/sitemap.routes";
import { buildSitemap, collectSitemapEntries } from "../lib/sitemap/build-sitemap";

const SITE = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Docs", siteUrl: "http://localhost:5000" };
const UPDATED = new Date("2026-10-01T09:30:00Z");

type FakeDoc = { id: string; slug: string; status: string; password?: string | null; parentId?: string | null; other?: object; updatedAt: Date; siteId?: string; blogId?: string };

const doc = (overrides: Partial<FakeDoc> & { slug: string }): FakeDoc => ({
	id: `id-${overrides.slug}`,
	status: "publish",
	password: null,
	parentId: null,
	updatedAt: UPDATED,
	siteId: SITE.id,
	...overrides,
});

const guides = doc({ slug: "guides" });
const install = doc({ slug: "install", parentId: guides.id });
const home = doc({ slug: "welcome" });
const draft = doc({ slug: "secret", status: "draft" });
const locked = doc({ slug: "locked", password: "pw" });
const hidden = doc({ slug: "thanks", other: { seo: { noIndex: true } } });
const post = doc({ slug: "hello world", blogId: "blog-1" });
const draftPost = doc({ slug: "soon", status: "draft", blogId: "blog-1" });

const fakeModels = ({ discourage = false }: { discourage?: boolean } = {}): Deps["models"] => {
	const pages = [guides, install, home, draft, locked, hidden];
	const posts = [post, draftPost];
	const matches = (rows: FakeDoc[], filters: { where: string; equals?: string; in?: string[] }[]): FakeDoc[] =>
		rows.filter((row) =>
			filters.every((filter) => {
				const value = (row as Record<string, unknown>)[filter.where];
				return filter.in ? filter.in.includes(String(value)) : value === filter.equals;
			}),
		);
	return {
		sites: {
			findById: async () => SITE,
			findByHostname: async () => SITE,
			findDefaultSite: async () => SITE,
			getSettings: async () => ({ general: { siteName: "Docs", siteDescription: "", siteUrl: "http://localhost:5000" }, reading: { discourageSearchIndexing: discourage } }),
		},
		pages: { findManyWhere: async (filters: { where: string; equals?: string }[]) => matches(pages, filters) },
		posts: { findManyWhere: async (filters: { where: string; equals?: string; in?: string[] }[]) => matches(posts, filters) },
		blogs: { findManyWhere: async () => [{ id: "blog-1" }] },
		options: { getOption: async (name: string) => (name === "homepage_page_slug" ? { value: "welcome" } : undefined) },
	} as unknown as Deps["models"];
};

const servers: Array<ReturnType<typeof createServer>> = [];

const getSitemap = async (models: Deps["models"]): Promise<Response> => {
	const app = express();
	app.use("/", createSitemapRoutes({ models } as Deps));
	const server = createServer(app);
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
	const { port } = server.address() as AddressInfo;
	return fetch(`http://127.0.0.1:${port}/sitemap.xml`);
};

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("collectSitemapEntries", () => {
	it("lists the home once, public pages at their nested address, and posts", () => {
		const entries = collectSitemapEntries({
			pages: [guides, install, home, draft, locked, hidden],
			paths: new Map([[install.id, "guides/install"]]),
			homepageSlug: "welcome",
			posts: [post, draftPost],
		});
		expect(entries.map((entry) => entry.path)).toEqual(["/", "/guides", "/guides/install", "/post/hello%20world"]);
		expect(entries[0].lastModified).toBe(UPDATED);
	});

	it("still lists the home when no homepage page is set", () => {
		const entries = collectSitemapEntries({ pages: [guides], paths: new Map(), homepageSlug: null, posts: [] });
		expect(entries).toEqual([{ path: "/", lastModified: null }, { path: "/guides", lastModified: UPDATED }]);
	});
});

describe("buildSitemap", () => {
	it("writes full addresses, day dates and escapes XML", () => {
		const xml = buildSitemap({ baseUrl: "https://docs.example.com", entries: [{ path: "/a&b", lastModified: UPDATED }, { path: "/", lastModified: null }] });
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain("<loc>https://docs.example.com/a&amp;b</loc>\n    <lastmod>2026-10-01</lastmod>");
		expect(xml).toContain("<loc>https://docs.example.com/</loc>\n  </url>");
	});
});

describe("GET /sitemap.xml", () => {
	it("serves the site's public addresses as XML", async () => {
		const response = await getSitemap(fakeModels());
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
		const xml = await response.text();
		expect(xml).toContain("<loc>http://localhost:5000/guides/install</loc>");
		expect(xml).toContain("<loc>http://localhost:5000/post/hello%20world</loc>");
		expect(xml).not.toContain("/welcome<");
		for (const left of ["secret", "locked", "thanks", "soon"]) expect(xml).not.toContain(left);
	});

	it("is empty when the site asks search engines to stay away", async () => {
		const xml = await (await getSitemap(fakeModels({ discourage: true }))).text();
		expect(xml).not.toContain("<url>");
		expect(xml).toContain("</urlset>");
	});
});
