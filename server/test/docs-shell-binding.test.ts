import { AddressInfo } from "node:net";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { Deps } from "../routes/shared/deps";
import { createRenderRoutes } from "../routes/render.routes";
import { publishedPageCache } from "../lib/published-page-cache";
import { SITE_PAGE_LIMIT } from "../lib/page-paths/page-paths";

const SITE = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Docs", siteUrl: "http://localhost:5000" };

type Block = { id: string; name: string; type: string; parentId: string | null; content: object; styles: object; settings: object; children?: Block[] };
type FakePage = { id: string; title: string; slug: string; status: string; password: string | null; parentId: string | null; menuOrder: number; blocks: Block[]; siteId: string; version: number; other: object; updatedAt: Date };

const heading = (id: string, value: string, parentId: string | null): Block => ({ id, name: "core/heading", type: "block", parentId, content: { kind: "text", value, level: 2 }, styles: {}, settings: {} });

const shellPage = (data: object, headings: Block[] = []): Block[] => [
	{
		id: "shell",
		name: "docs/shell",
		type: "container",
		parentId: null,
		content: { kind: "structured", data },
		styles: {},
		settings: {},
		children: [
			{ id: "page", name: "docs/page", type: "container", parentId: "shell", content: { kind: "structured", data: {} }, styles: {}, settings: {}, children: headings },
		],
	},
];

const page = (overrides: Partial<FakePage> & { slug: string }): FakePage => ({
	id: `id-${overrides.slug}`,
	title: overrides.slug,
	status: "publish",
	password: null,
	parentId: null,
	menuOrder: 0,
	blocks: shellPage({}),
	siteId: SITE.id,
	version: 1,
	other: {},
	updatedAt: new Date("2026-10-01T00:00:00Z"),
	...overrides,
});

const ROOT_SETTINGS = { inherit: false, title: "Acme Docs", links: [{ label: "GitHub", url: "https://github.com/acme" }], search: { show: true, label: "Find", placeholder: "Search the docs" } };

const docs = page({ slug: "docs", title: "Docs home", blocks: shellPage(ROOT_SETTINGS) });
const install = page({
	slug: "install",
	title: "Install",
	parentId: docs.id,
	menuOrder: 1,
	other: { seo: { metaDescription: "Get it running in a minute." } },
	blocks: shellPage({}, [heading("h1", "Before you start", "page"), heading("h2", "Run the installer", "page")]),
});
const guides = page({ slug: "guides", title: "Guides", parentId: docs.id, menuOrder: 2 });
const own = page({ slug: "own", title: "Own", parentId: docs.id, menuOrder: 3, blocks: shellPage({ inherit: false, title: "Own bar", search: { show: false, label: "Search", placeholder: "" } }) });
const plain = page({ slug: "about", title: "About", blocks: [heading("p", "Just text", null) as Block] });

type Calls = { limits: Array<number | undefined> };

const fakeModels = ({ rows, calls }: { rows: FakePage[]; calls: Calls }): Deps["models"] => {
	const matching = (filters: { where: string; equals?: string }[]): FakePage[] =>
		rows.filter((row) => filters.every((filter) => (row as Record<string, unknown>)[filter.where] === filter.equals));
	return {
		sites: {
			findById: async () => SITE,
			findByHostname: async () => SITE,
			findDefaultSite: async () => SITE,
			findMany: async () => [SITE],
			getSettings: async () => ({ general: { siteName: "Docs", siteDescription: "", siteUrl: "http://localhost:5000" }, reading: {} }),
		},
		pages: {
			findById: async (id: string) => rows.find((row) => row.id === id),
			findBySiteAndSlug: async (_siteId: string, slug: string) => rows.find((row) => row.slug === slug),
			count: async ({ where }: { where: { where: string; equals?: string }[] }) => matching(where).length,
			findManyWhere: async (filters: { where: string; equals?: string }[], options?: { limit?: number }) => {
				calls.limits.push(options?.limit);
				const found = matching(filters).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
				return options?.limit ? found.slice(0, options.limit) : found;
			},
		},
		posts: { findById: async () => undefined, findManyWhere: async () => [] },
		blogs: { findManyWhere: async () => [] },
		comments: { findManyWhere: async () => [] },
		users: { findById: async () => null },
		options: { getOption: async () => undefined },
	} as unknown as Deps["models"];
};

const servers: Array<ReturnType<typeof createServer>> = [];

const serve = async (rows: FakePage[]) => {
	publishedPageCache.clear();
	const calls: Calls = { limits: [] };
	const app = express();
	app.use(createRenderRoutes({ models: fakeModels({ rows, calls }) } as Deps));
	const server = createServer(app);
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
	const { port } = server.address() as AddressInfo;
	const get = async (path: string) => {
		const response = await fetch(`http://127.0.0.1:${port}${path}`);
		return { status: response.status, body: await response.text(), headers: response.headers };
	};
	return { get, calls };
};

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("serving a page with the docs shell and docs page", () => {
	const all = [docs, install, guides, own, plain];

	it("draws the top bar, the sidebar, the page title and the reading column", async () => {
		const { get } = await serve(all);
		const { status, body } = await get("/docs/install");
		expect(status).toBe(200);
		expect(body).toContain('class="np-dshell__bar"');
		expect(body).toContain('class="np-docs__sidebar"');
		expect(body).toContain('<h1 class="np-dpage__title">Install</h1>');
		expect(body).toContain("Get it running in a minute.");
		expect(body).toContain('class="np-docs__content np-prose"');
		expect(body).toContain('<script src="/vendor/docs.js"></script>');
	});

	it("inherit on: shows the root page's title, logo bar and links", async () => {
		const { get } = await serve(all);
		const { body } = await get("/docs/install");
		expect(body).toContain('<a class="np-dshell__brand" href="/docs">');
		expect(body).toContain("Acme Docs");
		expect(body).toContain('href="https://github.com/acme"');
	});

	it("inherit off: shows its own title and links, not the root's", async () => {
		const { get } = await serve(all);
		const { body } = await get("/docs/own");
		expect(body).toContain("Own bar");
		expect(body).not.toContain("Acme Docs");
		expect(body).not.toContain("https://github.com/acme");
	});

	it("search button opens search, and the search script loads only where search shows", async () => {
		const { get } = await serve(all);
		const withSearch = (await get("/docs/install")).body;
		expect(withSearch).toContain("data-np-search-open");
		expect(withSearch).toContain('<script src="/vendor/search.js"></script>');
		const searchOff = (await get("/docs/own")).body;
		expect(searchOff).not.toContain("data-np-search-open");
		expect(searchOff).not.toContain("/vendor/search.js");
		const plainPage = (await get("/about")).body;
		expect(plainPage).not.toContain("/vendor/search.js");
		expect(plainPage).not.toContain("data-np-docs");
	});

	it("lists the page's headings in 'On this page' with the ids the headings carry", async () => {
		const { get } = await serve(all);
		const { body } = await get("/docs/install");
		for (const id of ["before-you-start", "run-the-installer"]) {
			expect(body).toContain(`href="#${id}"`);
			expect(body).toContain(`id="${id}"`);
		}
	});

	it("links previous and next in the order of the page tree", async () => {
		const { get } = await serve(all);
		const { body } = await get("/docs/install");
		expect(body).toMatch(/<a class="np-docs__pager-link np-docs__pager-link--prev" href="\/docs" rel="prev">/);
		expect(body).toMatch(/<a class="np-docs__pager-link np-docs__pager-link--next" href="\/docs\/guides" rel="next">/);
	});

	it("is never stored, so a root page change shows at once", async () => {
		const { get } = await serve(all);
		const response = await get("/docs/install");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
