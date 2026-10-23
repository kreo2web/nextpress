import { AddressInfo } from "node:net";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../routes/shared/deps";
import { createPublicRoutes } from "../routes/public.routes";
import { createAgentPageRoutes } from "../routes/agent-pages.routes";
import { createRenderRoutes } from "../routes/render.routes";
import { createSiteSearch } from "../lib/site-search/site-search";
import { buildSearchIndex } from "../lib/site-search/build-search-index";

const SITE = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Docs", siteUrl: "http://localhost:5000" };

const heading = (id: string, value: string, level = 2): BlockConfig =>
	({ id, name: "core/heading", type: "block", parentId: null, content: { kind: "text", value, level } }) as BlockConfig;
const paragraph = (id: string, value: string): BlockConfig =>
	({ id, name: "core/paragraph", type: "block", parentId: null, content: { kind: "text", value } }) as BlockConfig;

type FakePage = { id: string; title: string; slug: string; status: string; password?: string | null; blocks: BlockConfig[]; version: number; updatedAt: Date; siteId: string; parentId?: string | null; other?: object };

const page = (overrides: Partial<FakePage> & { slug: string }): FakePage => ({
	id: `id-${overrides.slug}`,
	title: overrides.slug,
	status: "publish",
	password: null,
	blocks: [],
	version: 1,
	updatedAt: new Date("2026-10-01T00:00:00Z"),
	siteId: SITE.id,
	...overrides,
});

const installPage = page({
	slug: "install",
	title: "Install NextPress",
	blocks: [heading("a", "Install NextPress", 1), paragraph("b", "Download the release and run it."), heading("c", "Backups"), paragraph("d", "Copy the uploads folder before you update.")],
});
const aboutPage = page({ slug: "about", title: "About us", blocks: [paragraph("e", "We make websites simple.")] });
const draftPage = page({ slug: "secret-plans", title: "Secret plans", status: "draft", blocks: [paragraph("f", "zebra launch")] });
const lockedPage = page({ slug: "locked", title: "Locked", password: "pw", blocks: [paragraph("g", "zebra vault")] });

type Counters = { findMany: number };

const fakeModels = ({ pages, counters }: { pages: () => FakePage[]; counters?: Counters }): Deps["models"] => {
	const matches = (filters: { where: string; equals?: string }[]): FakePage[] =>
		pages().filter((row) => filters.every((filter) => (row as Record<string, unknown>)[filter.where] === filter.equals));
	return {
		sites: {
			findById: async () => SITE,
			findByHostname: async () => SITE,
			findDefaultSite: async () => SITE,
			getSettings: async () => ({ general: { siteName: "Docs", siteDescription: "Guides for NextPress", siteUrl: "http://localhost:5000" }, reading: {} }),
		},
		pages: {
			count: async ({ where }: { where: { where: string; equals?: string }[] }) => matches(where).length,
			findManyWhere: async (filters: { where: string; equals?: string }[], options?: { limit?: number }) => {
				if (filters.some((filter) => filter.where === "status") && options?.limit !== 1 && counters) counters.findMany += 1;
				const rows = matches(filters).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
				return options?.limit ? rows.slice(0, options.limit) : rows;
			},
			findBySiteAndSlug: async (_siteId: string, slug: string) => pages().find((row) => row.slug === slug),
			findById: async (id: string) => pages().find((row) => row.id === id),
		},
		options: { getOption: async () => undefined },
	} as unknown as Deps["models"];
};

const servers: Array<ReturnType<typeof createServer>> = [];

const serve = async ({ models, agentFirst = false }: { models: Deps["models"]; agentFirst?: boolean }) => {
	const app = express();
	const deps = { models } as Deps;
	app.use("/api/public", createPublicRoutes(deps));
	if (agentFirst) app.use("/", createAgentPageRoutes(deps));
	app.use("/", createRenderRoutes(deps));
	const server = createServer(app);
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
	const { port } = server.address() as AddressInfo;
	return (path: string) => fetch(`http://127.0.0.1:${port}${path}`);
};

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("buildSearchIndex", () => {
	const index = buildSearchIndex([installPage, aboutPage].map((row) => ({ id: row.id, title: row.title, slug: row.slug, blocks: row.blocks })));

	it("finds a page by its title", () => {
		expect(index.search({ query: "install", limit: 5 })[0]).toMatchObject({ title: "Install NextPress", path: "/install" });
	});

	it("links to the section when the words are under a heading", () => {
		const [hit] = index.search({ query: "uploads", limit: 5 });
		expect(hit).toMatchObject({ title: "Install NextPress", path: "/install#backups" });
		expect(hit.snippet).toContain("uploads folder");
	});

	it("matches the start of a word and shows each page once", () => {
		const hits = index.search({ query: "inst", limit: 5 });
		expect(hits.map((hit) => hit.path)).toEqual(["/install"]);
	});

	it("returns nothing for words that are not there, and respects the limit", () => {
		expect(index.search({ query: "xylophone", limit: 5 })).toEqual([]);
		expect(index.search({ query: "e", limit: 1 }).length).toBeLessThanOrEqual(1);
	});
});

describe("site search cache", () => {
	it("builds once, then again only after the site's pages change", async () => {
		let rows = [installPage, aboutPage];
		const counters: Counters = { findMany: 0 };
		const search = createSiteSearch({ models: fakeModels({ pages: () => rows, counters }) });

		await search.search({ siteId: SITE.id, query: "install", limit: 5 });
		await search.search({ siteId: SITE.id, query: "websites", limit: 5 });
		expect(counters.findMany).toBe(1);

		rows = [installPage, { ...aboutPage, blocks: [paragraph("e", "We make quokkas."), ], version: 2, updatedAt: new Date("2026-10-02T00:00:00Z") }];
		const hits = await search.search({ siteId: SITE.id, query: "quokkas", limit: 5 });
		expect(counters.findMany).toBe(2);
		expect(hits[0]?.path).toBe("/about");

		rows = [installPage];
		expect(await search.search({ siteId: SITE.id, query: "quokkas", limit: 5 })).toEqual([]);
		expect(counters.findMany).toBe(3);
	});

	it("never indexes drafts or passworded pages", async () => {
		const search = createSiteSearch({ models: fakeModels({ pages: () => [installPage, draftPage, lockedPage] }) });
		expect(await search.search({ siteId: SITE.id, query: "zebra", limit: 5 })).toEqual([]);
	});
});

describe("GET /api/public/search", () => {
	const rows = () => [installPage, aboutPage, draftPage, lockedPage];

	it("answers with results", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }) });
		const body = (await (await get("/api/public/search?q=backups")).json()) as { results: { title: string; path: string; snippet: string }[] };
		expect(body.results[0]).toMatchObject({ title: "Install NextPress", path: "/install#backups" });
	});

	it("answers an empty or blank q with an empty list", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }) });
		expect(await (await get("/api/public/search")).json()).toEqual({ results: [] });
		expect(await (await get("/api/public/search?q=%20%20")).json()).toEqual({ results: [] });
	});

	it("caps results at 20 and cuts a long q to 100 characters", async () => {
		const many = Array.from({ length: 30 }, (_, number) => page({ slug: `guide-${number}`, title: `Guide ${number}`, blocks: [paragraph(`p${number}`, "guide text")] }));
		const get = await serve({ models: fakeModels({ pages: () => many }) });
		const body = (await (await get("/api/public/search?q=guide&limit=500")).json()) as { results: unknown[] };
		expect(body.results).toHaveLength(20);
		const long = await get(`/api/public/search?q=${"a".repeat(400)}`);
		expect(long.status).toBe(200);
	});

	it("keeps drafts and passworded pages out of results", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }) });
		expect(await (await get("/api/public/search?q=zebra")).json()).toEqual({ results: [] });
	});

	it("slows one address down with a plain message after many searches", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }) });
		let last = 200;
		let message = "";
		for (let count = 0; count < 70; count += 1) {
			const response = await get("/api/public/search?q=install");
			last = response.status;
			if (last === 429) {
				message = ((await response.json()) as { message: string }).message;
				break;
			}
		}
		expect(last).toBe(429);
		expect(message).toBe("Too many searches in a row. Wait a moment and try again.");
	});
});

describe("pages for agents", () => {
	const rows = () => [installPage, aboutPage, draftPage, lockedPage];

	it("lists published pages in /llms.txt with their markdown address", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		const response = await get("/llms.txt");
		const text = await response.text();
		expect(response.status).toBe(200);
		expect(text.startsWith("# Docs\n\n> Guides for NextPress")).toBe(true);
		expect(text).toContain("- [Install NextPress](/install.md): Install NextPress");
		expect(text).toContain("- [About us](/about.md): We make websites simple.");
		expect(text).not.toContain("Secret plans");
		expect(text).not.toContain("Locked");
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
	});

	it("serves a page as markdown", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		const response = await get("/install.md");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
		expect(response.headers.get("x-robots-tag")).toBe("noindex");
		const text = await response.text();
		expect(text).toContain("# Install NextPress");
		expect(text).toContain("## Backups");
		expect(text).toContain("Copy the uploads folder before you update.");
	});

	it("puts the title on top when the page has no level-1 heading", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		expect((await (await get("/about.md")).text()).startsWith("# About us\n\nWe make websites simple.")).toBe(true);
	});

	it("answers 404 for drafts, passworded and missing pages", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		for (const path of ["/secret-plans.md", "/locked.md", "/nope.md"]) {
			expect((await get(path)).status).toBe(404);
		}
	});

	it("leaves the normal page route alone", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		const response = await get("/about");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});
});

describe("nested pages in search and for agents", () => {
	const guides = page({ slug: "guides", title: "Guides", status: "draft", blocks: [paragraph("n1", "Start here.")] });
	const nested = page({ slug: "backup", title: "Back up your site", parentId: guides.id, blocks: [heading("n2", "Back up your site", 1), paragraph("n3", "Copy the narwhal folder."), heading("n4", "Restore"), paragraph("n5", "Put the narwhal files back.")] });
	const rows = () => [guides, nested, aboutPage];

	it("gives search results the full address, even when the parent is a draft", async () => {
		const search = createSiteSearch({ models: fakeModels({ pages: rows }) });
		const [hit] = await search.search({ siteId: SITE.id, query: "restore", limit: 5 });
		expect(hit).toMatchObject({ title: "Back up your site", path: "/guides/backup#restore" });
		const [top] = await search.search({ siteId: SITE.id, query: "websites", limit: 5 });
		expect(top.path).toBe("/about");
	});

	it("links nested pages in /llms.txt by their full address", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		const text = await (await get("/llms.txt")).text();
		expect(text).toContain("(/guides/backup.md)");
		expect(text).toContain("(/about.md)");
		expect(text).not.toContain("Start here");
	});

	it("serves a nested page as markdown at its full address and by its slug", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		for (const path of ["/guides/backup.md", "/backup.md"]) {
			const response = await get(path);
			expect(response.status).toBe(200);
			expect(response.headers.get("x-robots-tag")).toBe("noindex");
			expect(await response.text()).toContain("Copy the narwhal folder.");
		}
	});

	it("answers 404 for a wrong parent, a hidden parent's own page and an unknown address", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		for (const path of ["/about/backup.md", "/guides.md", "/guides/nope.md"]) {
			expect((await get(path)).status).toBe(404);
		}
	});

	it("does not take over files under fixed folders", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }), agentFirst: true });
		const response = await get("/vendor/readme.md");
		expect(response.headers.get("x-robots-tag")).toBeNull();
	});

	it("the public page API answers a full address and returns it as path", async () => {
		const get = await serve({ models: fakeModels({ pages: rows }) });
		const body = (await (await get("/api/public/page/guides/backup")).json()) as { path: string; title: string };
		expect(body).toMatchObject({ path: "guides/backup", title: "Back up your site" });
		const flat = (await (await get("/api/public/page/backup")).json()) as { path: string };
		expect(flat.path).toBe("guides/backup");
		expect((await get("/api/public/page/about/backup")).status).toBe(404);
		expect((await get("/api/public/page/guides")).status).toBe(404);
	});
});
