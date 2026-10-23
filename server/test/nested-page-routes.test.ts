import { AddressInfo } from "node:net";
import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import type { Deps } from "../routes/shared/deps";
import { createRenderRoutes } from "../routes/render.routes";
import { publishedPageCache } from "../lib/published-page-cache";

const SITE = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Docs", siteUrl: "http://localhost:5000" };

type FakePage = { id: string; title: string; slug: string; status: string; password: string | null; parentId: string | null; blocks: unknown[]; siteId: string; version: number; other: object };

const page = (overrides: Partial<FakePage> & { slug: string }): FakePage => ({
	id: `id-${overrides.slug}`,
	title: overrides.slug,
	status: "publish",
	password: null,
	parentId: null,
	blocks: [],
	siteId: SITE.id,
	version: 1,
	other: {},
	...overrides,
});

const guides = page({ slug: "guides" });
const install = page({ slug: "install", parentId: guides.id });
const docker = page({ slug: "docker", parentId: install.id });
const about = page({ slug: "about" });

const fakeModels = (rows: FakePage[]): Deps["models"] =>
	({
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
		},
		posts: { findById: async () => undefined, findManyWhere: async () => [] },
		blogs: { findManyWhere: async () => [] },
		comments: { findManyWhere: async () => [] },
		users: { findById: async () => null },
		options: { getOption: async () => undefined },
	}) as unknown as Deps["models"];

const servers: Array<ReturnType<typeof createServer>> = [];

const serve = async (rows: FakePage[]) => {
	publishedPageCache.clear();
	const app = express();
	app.use(createRenderRoutes({ models: fakeModels(rows) } as Deps));
	// Whatever the page routes let through ends up here, like the files and the app do in the real server.
	app.use((_req, res) => res.status(404).send("fell-through"));
	const server = createServer(app);
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
	const { port } = server.address() as AddressInfo;
	return async (path: string) => {
		const response = await fetch(`http://127.0.0.1:${port}${path}`);
		const body = await response.text();
		return { status: response.status, body, canonical: /<link rel="canonical" href="([^"]*)"/.exec(body)?.[1] };
	};
};

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("nested page addresses", () => {
	const all = [guides, install, docker, about];

	it("serves a nested page at its full address, with that address as canonical", async () => {
		const get = await serve(all);
		const response = await get("/guides/install");
		expect(response.status).toBe(200);
		expect(response.canonical).toBe("http://localhost:5000/guides/install");
		expect((await get("/guides/install/docker/")).canonical).toBe("http://localhost:5000/guides/install/docker");
	});

	it("still serves a nested page by its own slug, naming the full address as canonical", async () => {
		const get = await serve(all);
		const response = await get("/install");
		expect(response.status).toBe(200);
		expect(response.canonical).toBe("http://localhost:5000/guides/install");
	});

	it("leaves top-level pages as they were", async () => {
		const get = await serve(all);
		const response = await get("/about");
		expect(response.status).toBe(200);
		expect(response.canonical).toBe("http://localhost:5000/about");
		expect((await get("/guides")).canonical).toBe("http://localhost:5000/guides");
	});

	it("keeps the parent in the address when the parent is a draft, but hides the parent itself", async () => {
		const get = await serve([{ ...guides, status: "draft" }, install]);
		const child = await get("/guides/install");
		expect(child.status).toBe(200);
		expect(child.canonical).toBe("http://localhost:5000/guides/install");
		expect((await get("/install")).canonical).toBe("http://localhost:5000/guides/install");
		expect((await get("/guides")).body).toBe("fell-through");
	});

	it("does not show draft, private or password-protected nested pages", async () => {
		for (const hidden of [{ status: "draft" }, { status: "private" }, { password: "secret" }]) {
			const get = await serve([guides, { ...install, ...hidden }]);
			expect((await get("/guides/install")).body).toBe("fell-through");
			expect((await get("/install")).body).toBe("fell-through");
		}
	});

	it("answers a wrong parent or unknown address by letting it fall through", async () => {
		const get = await serve(all);
		for (const path of ["/about/install", "/guides/nope", "/install/docker", "/guides/install/nope", "/a/b/c/d"]) {
			expect((await get(path)).body).toBe("fell-through");
		}
	});

	it("never takes over fixed addresses and files, even if a page has that slug", async () => {
		const sneaky = [page({ slug: "admin" }), page({ slug: "api" }), page({ slug: "vendor" }), page({ slug: "uploads" }), page({ slug: "settings", parentId: "id-admin" }), page({ slug: "logo", parentId: "id-api" }), page({ slug: "x", parentId: "id-uploads" }), page({ slug: "y", parentId: "id-vendor" })];
		const get = await serve(sneaky);
		for (const path of ["/admin/settings", "/api/logo", "/uploads/x", "/vendor/y", "/vendor/animate.min.css", "/guides/logo.png", "/node_modules/y", "/@vite/client"]) {
			expect((await get(path)).body).toBe("fell-through");
		}
	});

	it("lets a child page use a name that is reserved at the top level", async () => {
		const get = await serve([guides, page({ slug: "post", parentId: guides.id }), page({ slug: "home", parentId: guides.id })]);
		expect((await get("/guides/post")).status).toBe(200);
		expect((await get("/guides/home")).canonical).toBe("http://localhost:5000/guides/home");
	});

	it("serves a page whose parents loop at its own slug only", async () => {
		const a = page({ slug: "loop-a", parentId: "id-loop-b" });
		const b = page({ slug: "loop-b", parentId: "id-loop-a" });
		const get = await serve([a, b]);
		expect((await get("/loop-a")).canonical).toBe("http://localhost:5000/loop-a");
		expect((await get("/loop-b/loop-a")).body).toBe("fell-through");
	});
});
