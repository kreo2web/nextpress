import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import multer from "multer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getZodSchema } from "@shared/zod-schema";
import { authService, requireAuth } from "../auth";
import { CONFIG, getSiteSettings, parsePaginationParams, parseStatusParam } from "../config";
import type { Deps } from "../routes/shared/deps";
import { createBlogsRoutes } from "../routes/blogs.routes";
import { createWordPressImportRoutes } from "../routes/import.wordpress.routes";
import { siteSearchIndexOf } from "../lib/site-search";
import { ID, callAs, models, seedAccessFixture } from "./fixtures/access-fixture";

vi.mock("../lib/better-auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const userId = headers.get("x-test-user");
				return userId ? { user: { id: userId } } : null;
			},
		},
	},
}));

// The WordPress site is a true outside service: stand in for it, keep the route and the database real.
vi.mock("../utils/validate-external-url", () => ({
	validateExternalUrl: async (url: string) => ({ ok: true, url: new URL(url) }),
}));
vi.mock("@shared/import/wordpress/create-wordpress-importer", () => ({
	fetchWpFeaturedImageUrl: async () => null,
	createWordPressImporter: () => ({
		importPages: async (params: { siteId: string; authorId: string; createPage: (data: object) => Promise<{ id: string }> }) => {
			const page = await params.createPage({ title: "From WordPress", slug: "from-wordpress", status: "publish", siteId: params.siteId, authorId: params.authorId, blocks: [] });
			return { imported: [page], updated: [], skipped: [], failed: [] };
		},
	}),
}));

let server: Server;
let call: ReturnType<typeof callAs>;
const schedule = vi.spyOn(siteSearchIndexOf({ models }), "schedule");

beforeAll(async () => {
	const uploadDir = mkdtempSync(path.join(tmpdir(), "np-search-other-"));
	const deps = {
		models,
		hooks: { doAction: () => undefined, applyFilters: (_name: string, value: unknown) => value },
		authService,
		requireAuth,
		CONFIG,
		parsePaginationParams,
		parseStatusParam,
		getSiteSettings,
		schemas: { pages: getZodSchema("pages"), blogs: getZodSchema("blogs") },
		upload: multer({ dest: uploadDir }),
		uploadDir,
	} as unknown as Deps;
	const app = express();
	app.use(express.json());
	app.use("/api/blogs", createBlogsRoutes(deps));
	app.use("/api/import/wordpress", createWordPressImportRoutes(deps));
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	call = callAs(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
	await seedAccessFixture();
	schedule.mockClear();
});

describe("pages written by other routes tell search too", () => {
	it("a WordPress page import", async () => {
		const response = await call({
			userId: ID.mainAdmin,
			method: "POST",
			path: "/api/import/wordpress/pages",
			body: { baseUrl: "https://blog.example.com", wpIds: [1], siteId: ID.siteA },
		});
		expect(response.status).toBe(200);
		expect(await models.pages.findBySiteAndSlug(ID.siteA, "from-wordpress")).toBeTruthy();
		expect(schedule).toHaveBeenCalledWith({ siteId: ID.siteA });
	});

	it("making a blog (it makes the blog's index page)", async () => {
		const response = await call({ userId: ID.mainAdmin, method: "POST", path: "/api/blogs", body: { name: "News", slug: "news", siteId: ID.siteA } });
		expect(response.status).toBe(201);
		expect(schedule).toHaveBeenCalledWith({ siteId: ID.siteA });
	});

	it("deleting a blog (it removes the blog's index page)", async () => {
		await models.comments.delete(ID.commentA);
		await models.posts.delete(ID.postA);
		const response = await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/blogs/${ID.blogA}` });
		expect(response.status).toBe(200);
		expect(await models.pages.findById(ID.pageA)).toBeUndefined();
		expect(schedule).toHaveBeenCalledWith({ siteId: ID.siteA });
	});

	it("a refused blog delete tells search nothing", async () => {
		const response = await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/blogs/${ID.blogA}` });
		expect(response.status).toBe(409);
		expect(schedule).not.toHaveBeenCalled();
	});
});
