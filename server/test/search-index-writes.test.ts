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
import { createPagesRoutes } from "../routes/pages.routes";
import { createPageTransferRoutes } from "../routes/page-transfer.routes";
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

/**
 * The real page routes on the in-memory test database. Search is told about a change through
 * `schedule`, so that is what is watched; how a rebuild is timed is covered in
 * search-index-scheduler.test.ts.
 */
let server: Server;
let baseUrl = "";
let call: ReturnType<typeof callAs>;
const schedule = vi.spyOn(siteSearchIndexOf({ models }), "schedule");

beforeAll(async () => {
	const uploadDir = mkdtempSync(path.join(tmpdir(), "np-search-writes-"));
	const deps = {
		models,
		hooks: { doAction: () => undefined, applyFilters: (_name: string, value: unknown) => value },
		authService,
		requireAuth,
		CONFIG,
		parsePaginationParams,
		parseStatusParam,
		getSiteSettings,
		schemas: { pages: getZodSchema("pages") },
		upload: multer({ dest: uploadDir }),
		uploadDir,
	} as unknown as Deps;
	const app = express();
	app.use(express.json());
	app.use("/api/pages", createPagesRoutes(deps));
	app.use("/api/page-transfer", createPageTransferRoutes(deps));
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	call = callAs(baseUrl);
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
	await seedAccessFixture();
	schedule.mockClear();
});

const editor = ID.mainAdmin;
const announced = (siteId: string = ID.siteA) => expect(schedule).toHaveBeenCalledWith({ siteId });

const makePage = async (fields: Record<string, unknown> = {}): Promise<{ id: string; version: number }> => {
	const created = await call({ userId: editor, method: "POST", path: "/api/pages", body: { title: "Guide", slug: "guide", status: "draft", siteId: ID.siteA, blocks: [], ...fields } });
	expect(created.status).toBe(201);
	schedule.mockClear();
	return { id: String(created.body.id), version: Number(created.body.version ?? 0) };
};

const save = (id: string, version: number, changes: Record<string, unknown>) =>
	call({ userId: editor, method: "PUT", path: `/api/pages/${id}`, body: { expectedVersion: version, ...changes } });

describe("every change to a site's pages tells search", () => {
	it("making a page", async () => {
		const created = await call({ userId: editor, method: "POST", path: "/api/pages", body: { title: "Guide", slug: "guide", status: "publish", siteId: ID.siteA, blocks: [] } });
		expect(created.status).toBe(201);
		announced();
		expect(schedule).toHaveBeenCalledTimes(1);
	});

	it("publishing a draft", async () => {
		const { id, version } = await makePage();
		expect((await save(id, version, { status: "publish" })).status).toBe(200);
		announced();
	});

	it("unpublishing a page", async () => {
		const { id, version } = await makePage({ status: "publish" });
		expect((await save(id, version, { status: "draft" })).status).toBe(200);
		announced();
	});

	it("renaming a page", async () => {
		const { id, version } = await makePage({ status: "publish" });
		expect((await save(id, version, { title: "Guide, renamed", slug: "guide-renamed" })).status).toBe(200);
		announced();
	});

	it("moving a page under another one", async () => {
		const parent = await makePage({ title: "Docs", slug: "docs", status: "publish" });
		const child = await makePage({ title: "Install", slug: "install", status: "publish" });
		expect((await save(child.id, child.version, { parentId: parent.id })).status).toBe(200);
		announced();
	});

	it("putting pages in a new order", async () => {
		const first = await makePage({ title: "One", slug: "one" });
		const second = await makePage({ title: "Two", slug: "two" });
		const moved = await call({
			userId: editor,
			method: "PATCH",
			path: "/api/pages/reorder",
			body: { siteId: ID.siteA, items: [{ id: first.id, menuOrder: 2 }, { id: second.id, menuOrder: 1 }] },
		});
		expect(moved.status).toBe(200);
		announced();
	});

	it("restoring an earlier version", async () => {
		const { id, version } = await makePage({ status: "publish" });
		expect((await save(id, version, { title: "Guide, second draft" })).status).toBe(200);
		schedule.mockClear();
		const restored = await call({ userId: editor, method: "POST", path: `/api/pages/${id}/restore`, body: { version } });
		expect(restored.status).toBe(200);
		announced();
	});

	it("copying a page", async () => {
		const { id } = await makePage({ status: "publish" });
		const copy = await call({ userId: editor, method: "POST", path: `/api/pages/${id}/duplicate`, body: { title: "Guide copy" } });
		expect(copy.status).toBe(201);
		announced();
	});

	it("deleting a page", async () => {
		const { id } = await makePage({ status: "publish" });
		expect((await call({ userId: editor, method: "DELETE", path: `/api/pages/${id}` })).status).toBe(200);
		announced();
	});

	it("bringing a page in from a page file", async () => {
		const file = {
			format: "nextpress-page",
			formatVersion: 2,
			appVersion: "test",
			createdAt: "2026-10-24T00:00:00.000Z",
			source: "export",
			page: { title: "Imported guide", slug: "imported-guide", featuredImage: null, other: {} },
			blocks: [],
			files: [],
		};
		const form = new FormData();
		form.append("package", new Blob([JSON.stringify(file)], { type: "application/json" }), "guide.nextpress-page.json");
		const response = await fetch(`${baseUrl}/api/page-transfer/import?siteId=${ID.siteA}`, { method: "POST", headers: { "x-test-user": editor }, body: form });
		expect(response.status).toBe(201);
		announced();
	});
});

describe("a change that did not happen tells search nothing", () => {
	it("an out-of-date save, a missing page, a stranger and a bad reorder", async () => {
		const { id, version } = await makePage({ status: "publish" });
		expect((await save(id, version + 5, { title: "Too late" })).status).toBe(409);
		expect((await call({ userId: editor, method: "DELETE", path: "/api/pages/00000000-0000-4000-8000-000000000999" })).status).toBe(404);
		expect((await call({ userId: ID.stranger, method: "PUT", path: `/api/pages/${id}`, body: { expectedVersion: version, title: "Mine" } })).status).toBeGreaterThanOrEqual(400);
		expect((await call({ userId: ID.stranger, method: "DELETE", path: `/api/pages/${id}` })).status).toBeGreaterThanOrEqual(400);
		expect((await call({ userId: editor, method: "PATCH", path: "/api/pages/reorder", body: { siteId: ID.siteA, items: [] } })).status).toBe(400);
		expect(schedule).not.toHaveBeenCalled();
	});

	it("reading pages", async () => {
		const { id } = await makePage({ status: "publish" });
		await call({ userId: editor, path: `/api/pages/${id}` });
		await call({ userId: editor, path: "/api/pages?status=any" });
		expect(schedule).not.toHaveBeenCalled();
	});
});
