import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import multer from "multer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getZodSchema } from "@shared/zod-schema";
import { newPostBody } from "@shared/blog/compose-blog-post";
import type { BlockConfig } from "@shared/schema-types";
import { authService, requireAuth } from "../auth";
import { CONFIG, getSiteSettings, parsePaginationParams, parseStatusParam } from "../config";
import type { Deps } from "../routes/shared/deps";
import { createBlogsRoutes } from "../routes/blogs.routes";
import { createPublicRoutes } from "../routes/public.routes";
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

/** The real blog and public routes on the in-memory test database. */
let server: Server;
let call: ReturnType<typeof callAs>;

beforeAll(async () => {
	const uploadDir = mkdtempSync(path.join(tmpdir(), "np-blog-writing-"));
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
	app.use("/api/public", createPublicRoutes(deps));
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	call = callAs(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
	await seedAccessFixture();
});

const admin = ID.mainAdmin;

/** The blog setup's request: a name, the home's address, live, cards, and what posts show. */
const setUpBlog = async () => {
	const made = await call({
		userId: admin,
		method: "POST",
		path: `/api/blogs?siteId=${ID.siteA}`,
		body: { name: "Field Notes", status: "publish", settings: { post: { comments: false } }, home: { address: "notes", publish: true, list: { layout: "grid", showAuthor: false } } },
	});
	expect(made.status).toBe(201);
	return made.body as { id: string; pageId: string };
};

describe("setting up a blog", () => {
	it("makes its home page at the address asked for, live, listing posts the way asked", async () => {
		const blog = await setUpBlog();
		const home = await call({ userId: admin, path: `/api/blogs/${blog.id}/home` });
		expect(home.status).toBe(200);
		expect(home.body).toMatchObject({ pageId: blog.pageId, address: "/notes", status: "publish", list: { layout: "grid", showAuthor: false, showDate: true } });
	});

	it("changes how the home lists posts, saved as a new version of its page", async () => {
		const blog = await setUpBlog();
		const before = await models.pages.findById(blog.pageId);
		const changed = await call({ userId: admin, method: "PUT", path: `/api/blogs/${blog.id}/home/list`, body: { layout: "list", showExcerpt: false, nonsense: true } });
		expect(changed.status).toBe(200);
		expect(changed.body).toMatchObject({ list: { layout: "list", showExcerpt: false, showAuthor: false } });
		const after = await models.pages.findById(blog.pageId);
		expect(after?.version).toBe((before?.version ?? 0) + 1);
	});

	it("keeps the old home for callers that don't ask (a draft at blog-<slug>)", async () => {
		const made = await call({ userId: admin, method: "POST", path: `/api/blogs?siteId=${ID.siteA}`, body: { name: "Changelog" } });
		const home = await call({ userId: admin, path: `/api/blogs/${String(made.body.id)}/home` });
		expect(home.body).toMatchObject({ address: "/blog-changelog", status: "draft", list: { layout: "cards" } });
	});
});

describe("a written post, published", () => {
	it("is shown inside its blog's look, and a change to the look reaches it at once", async () => {
		const blog = await setUpBlog();
		let n = 0;
		await models.posts.create({ title: "Hello", slug: "hello", status: "publish", authorId: admin, blogId: blog.id, blocks: newPostBody({ newId: () => `body-${++n}` }) } as never);

		const read = async () => {
			const response = await call({ userId: null, path: `/api/public/post/hello?siteId=${ID.siteA}` });
			expect(response.status).toBe(200);
			const blocks = response.body.blocks as BlockConfig[];
			return blocks[0].children?.map((block) => block.name) ?? [];
		};
		// The blog turned comments off at setup.
		expect(await read()).toEqual(["post/title", "post/excerpt", "post/info", "post/featured-image", "post/body", "post/author-box", "post/navigation"]);

		const changed = await call({ userId: admin, method: "PUT", path: `/api/blogs/${blog.id}`, body: { settings: { post: { comments: true, author: false } } } });
		expect(changed.status).toBe(200);
		expect(await read()).toEqual(["post/title", "post/excerpt", "post/info", "post/featured-image", "post/body", "post/navigation", "post/comments"]);
	});
});
