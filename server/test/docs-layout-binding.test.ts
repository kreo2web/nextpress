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
const docsLayout: Block = { id: "layout", name: "core/docs-layout", type: "container", parentId: null, content: { kind: "structured", data: {} }, styles: {}, settings: {}, children: [heading("h", "Before you start", "layout")] };

const page = (overrides: Partial<FakePage> & { slug: string }): FakePage => ({
	id: `id-${overrides.slug}`,
	title: overrides.slug,
	status: "publish",
	password: null,
	parentId: null,
	menuOrder: 0,
	blocks: [docsLayout],
	siteId: SITE.id,
	version: 1,
	other: {},
	updatedAt: new Date("2026-10-01T00:00:00Z"),
	...overrides,
});

const docs = page({ slug: "docs", title: "Docs home" });
const install = page({ slug: "install", title: "Install", parentId: docs.id, menuOrder: 1 });
const secret = page({ slug: "secret", title: "Secret", parentId: docs.id, menuOrder: 2, status: "draft" });
const plain = page({ slug: "about", title: "About", blocks: [heading("p", "Just text", null)] });

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

describe("serving a page with the docs layout", () => {
	const all = [docs, install, secret, plain];

	it("fills the sidebar with the site's open pages and marks the one being read", async () => {
		const { get } = await serve(all);
		const { status, body } = await get("/docs/install");
		expect(status).toBe(200);
		expect(body).toContain('aria-label="Docs"');
		expect(body).toContain('<a class="np-docs__link" href="/docs">Docs home</a>');
		expect(body).toContain('<a class="np-docs__link" href="/docs/install" aria-current="page">Install</a>');
		expect(body).not.toContain("Secret");
	});

	it("adds the contents list, the markdown address and the script", async () => {
		const { get } = await serve(all);
		const { body } = await get("/docs/install");
		expect(body).toContain('href="#before-you-start"');
		expect(body).toContain('data-markdown="/docs/install.md"');
		expect(body).toContain('<script src="/vendor/docs.js"></script>');
	});

	it("reads the site's pages once with the high limit, then only checks for changes", async () => {
		const rows = all.map((row) => ({ ...row }));
		const { get, calls } = await serve(rows);
		await get("/docs/install");
		expect(calls.limits).toEqual([1, SITE_PAGE_LIMIT]);

		calls.limits.length = 0;
		await get("/docs/install");
		expect(calls.limits).toEqual([1]);

		calls.limits.length = 0;
		Object.assign(rows[1], { title: "Install NextPress", updatedAt: new Date("2026-10-02T00:00:00Z") });
		const { body } = await get("/docs/install");
		expect(calls.limits).toEqual([1, SITE_PAGE_LIMIT]);
		expect(body).toContain(">Install NextPress</a>");
	});

	it("is never stored, so a sidebar change on another page shows at once", async () => {
		const { get } = await serve(all);
		const response = await get("/docs/install");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-nextpress-cache")).toBe("skip");
	});

	it("does no extra work and loads no script for a page without the block", async () => {
		const { get, calls } = await serve(all);
		const { body } = await get("/about");
		expect(calls.limits).toEqual([]);
		expect(body).not.toContain("/vendor/docs.js");
		expect(body).not.toContain("data-np-docs");
	});
});
