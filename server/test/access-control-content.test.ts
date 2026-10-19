import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, callAs, models, seedAccessFixture, startAccessApp, type AccessApp } from "./fixtures/access-fixture";

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

let app: AccessApp;
let call: ReturnType<typeof callAs>;

beforeAll(async () => {
	app = await startAccessApp();
	call = callAs(app.baseUrl);
});

afterAll(async () => {
	await app.close();
});

beforeEach(async () => {
	await seedAccessFixture();
});

describe("one site's content stays on that site", () => {
	it("an editor on site B can't change or delete site A's blog, and can't tell it exists", async () => {
		expect((await call({ userId: ID.editorB, method: "DELETE", path: `/api/blogs/${ID.blogA}` })).status).toBe(404);
		expect((await call({ userId: ID.editorB, method: "PUT", path: `/api/blogs/${ID.blogA}`, body: { name: "Mine now" } })).status).toBe(404);
		expect(await models.blogs.findById(ID.blogA)).toBeTruthy();
		expect(await models.pages.findById(ID.pageA)).toBeTruthy();
	});

	it("a blog can't be moved to another site or pointed at another site's page", async () => {
		const moved = await call({ userId: ID.siteBOwner, method: "PUT", path: `/api/blogs/${ID.blogB}`, body: { name: "B2", siteId: ID.siteA, pageId: ID.pageA } });
		expect(moved.status).toBe(200);
		const blog = await models.blogs.findById(ID.blogB);
		expect(blog).toMatchObject({ name: "B2", siteId: ID.siteB, pageId: ID.pageB });

		// A blog with posts asks for them to be moved first; once empty, deleting it removes its own page only.
		const withPosts = await call({ userId: ID.siteBOwner, method: "DELETE", path: `/api/blogs/${ID.blogB}` });
		expect(withPosts.status).toBe(409);
		await models.posts.delete(ID.postB);
		expect((await call({ userId: ID.siteBOwner, method: "DELETE", path: `/api/blogs/${ID.blogB}` })).status).toBe(200);
		expect(await models.pages.findById(ID.pageB)).toBeUndefined();
		expect(await models.pages.findById(ID.pageA)).toBeTruthy();
	});

	it("visitors see published blogs only; the site's team sees drafts", async () => {
		expect((await call({ userId: null, path: `/api/blogs/${ID.blogB}` })).status).toBe(404);
		expect((await call({ userId: ID.editorB, path: `/api/blogs/${ID.blogB}` })).status).toBe(200);
		const visitorList = await call({ userId: null, path: `/api/blogs?siteId=${ID.siteB}` });
		expect(visitorList.body.blogs).toEqual([]);
	});

	it("posts go only into blogs on a site the person edits, and never move to another site", async () => {
		const intoA = await call({ userId: ID.editorB, method: "POST", path: "/api/posts", body: { title: "Sneaky", blogId: ID.blogA, blocks: [] } });
		expect(intoA.status).toBe(404);
		const noBlog = await call({ userId: ID.editorB, method: "POST", path: "/api/posts", body: { title: "Lost", blocks: [] } });
		expect(noBlog.status).toBe(400);
		const intoB = await call({ userId: ID.editorB, method: "POST", path: "/api/posts", body: { title: "Fine", blogId: ID.blogB, blocks: [] } });
		expect(intoB.status).toBe(201);

		const move = await call({ userId: ID.editorB, method: "PUT", path: `/api/posts/${ID.postB}`, body: { blogId: ID.blogA, expectedVersion: 0 } });
		expect(move.status).toBe(404);
		expect((await models.posts.findById(ID.postB))?.blogId).toBe(ID.blogB);
		expect((await call({ userId: ID.editorB, method: "DELETE", path: `/api/posts/${ID.postA}` })).status).toBe(404);
	});

	it("media: other sites can't touch it, and an edit never changes the stored file name", async () => {
		expect((await call({ userId: ID.editorB, method: "DELETE", path: `/api/media/${ID.mediaA}` })).status).toBe(404);

		const edit = await call({ userId: ID.mainAdmin, method: "PUT", path: `/api/media/${ID.mediaA}`, body: { alt: "A cat", filename: "../../server/index.ts", siteId: ID.siteB } });
		expect(edit.status).toBe(200);
		expect(await models.media.findById(ID.mediaA)).toMatchObject({ alt: "A cat", filename: "a.png", siteId: ID.siteA });
	});

	it("deleting media never removes a file outside the uploads folder", async () => {
		const outside = path.join(path.dirname(app.uploadDir), `outside-${Date.now()}.txt`);
		writeFileSync(outside, "keep me");
		await models.media.update(ID.mediaA, { filename: path.relative(app.uploadDir, outside) });

		expect((await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/media/${ID.mediaA}` })).status).toBe(200);
		expect(existsSync(outside)).toBe(true);
	});
});

describe("comments", () => {
	it("a visitor can't post as approved or as someone else; moderation decides", async () => {
		const posted = await call({
			userId: null,
			method: "POST",
			path: "/api/comments",
			body: { postId: ID.postA, content: "Nice", authorName: "Vee", status: "approved", authorId: ID.mainOwner },
		});
		expect(posted.status).toBe(201);
		expect(posted.body).toMatchObject({ status: "pending", authorName: "Vee" });
		const stored = await models.comments.findById(String(posted.body.id));
		expect(stored).toMatchObject({ status: "pending", authorId: null });
	});

	it("comments go live at once when the site turns moderation off, and are refused when comments are off", async () => {
		await models.sites.updateSettings({ discussion: { moderateComments: false } }, ID.siteA);
		const live = await call({ userId: null, method: "POST", path: "/api/comments", body: { postId: ID.postA, content: "Hi", authorName: "Vee" } });
		expect(live.body.status).toBe("approved");

		await models.sites.updateSettings({ discussion: { enableComments: false } }, ID.siteB);
		const closed = await call({ userId: null, method: "POST", path: "/api/comments", body: { postId: ID.postB, content: "Hi", authorName: "Vee" } });
		expect(closed.status).toBe(403);
	});

	it("visitors read approved comments without emails; the site's team reads everything", async () => {
		const visitor = await call({ userId: null, path: `/api/comments?siteId=${ID.siteA}&status=all` });
		expect(visitor.body.comments).toEqual([]);

		const team = await call({ userId: ID.mainAdmin, path: `/api/comments?siteId=${ID.siteA}&status=all` });
		const rows = team.body.comments as Array<Record<string, unknown>>;
		expect(rows).toHaveLength(1);
		expect(rows[0]?.authorEmail).toBe("visitor@test.local");
	});

	it("only the comment's own site moderates it", async () => {
		expect((await call({ userId: ID.editorB, method: "PATCH", path: `/api/comments/${ID.commentA}/approve` })).status).toBe(404);
		expect((await call({ userId: ID.subscriberA, method: "DELETE", path: `/api/comments/${ID.commentA}` })).status).toBe(403);
		const approved = await call({ userId: ID.mainAdmin, method: "PATCH", path: `/api/comments/${ID.commentA}/approve` });
		expect(approved.status).toBe(200);
		expect((await models.comments.findById(ID.commentA))?.status).toBe("approved");
	});
});

describe("install-wide and shared things", () => {
	it("plugins are for main-site admins only", async () => {
		expect((await call({ userId: ID.siteBOwner, path: "/api/plugins" })).status).toBe(403);
		expect((await call({ userId: ID.editorB, method: "POST", path: "/api/plugins", body: { name: "Evil" } })).status).toBe(403);
		expect((await call({ userId: ID.mainAdmin, path: "/api/plugins" })).status).toBe(200);
	});

	it("a theme another site uses can't be restyled by one site's owner; one only their site uses can", async () => {
		const shared = await call({ userId: ID.siteBOwner, method: "PATCH", path: `/api/themes/${ID.sharedTheme}`, body: { name: "Hijacked" } });
		expect(shared.status).toBe(403);
		expect((await models.themes.findById(ID.sharedTheme))?.name).toBe("Shared");

		await models.sites.update(ID.siteB, { activeThemeId: ID.themeB });
		expect((await call({ userId: ID.siteBOwner, method: "PATCH", path: `/api/themes/${ID.themeB}`, body: { name: "B look" } })).status).toBe(200);
		expect((await call({ userId: ID.mainAdmin, method: "PATCH", path: `/api/themes/${ID.sharedTheme}`, body: { name: "Main look" } })).status).toBe(200);
	});

	it("switching a site's theme needs that site's admin", async () => {
		expect((await call({ userId: ID.editorB, method: "POST", path: `/api/themes/${ID.themeB}/activate?siteId=${ID.siteB}` })).status).toBe(403);
		expect((await call({ userId: ID.siteBOwner, method: "POST", path: `/api/themes/${ID.themeB}/activate?siteId=${ID.siteB}` })).status).toBe(200);
	});

	it("visitors read only the options a published site needs", async () => {
		expect((await call({ userId: null, path: `/api/options/homepage_page_slug?siteId=${ID.siteA}` })).status).toBe(200);
		expect((await call({ userId: null, path: `/api/options/plugin_secret?siteId=${ID.siteA}` })).status).toBe(404);
		expect((await call({ userId: ID.mainAdmin, path: `/api/options/plugin_secret?siteId=${ID.siteA}` })).status).toBe(200);
		expect((await call({ userId: ID.editorB, method: "POST", path: `/api/options?siteId=${ID.siteB}`, body: { name: "x", value: "y" } })).status).toBe(403);
	});
});

describe("a person loses access at once", () => {
	it("taking away someone's role closes the site to them on their very next request", async () => {
		expect((await call({ userId: ID.editorB, path: `/api/settings?siteId=${ID.siteB}` })).status).toBe(200);
		await models.userRoles.removeRole(ID.editorB, ID.editorRole, ID.siteB);
		expect((await call({ userId: ID.editorB, path: `/api/settings?siteId=${ID.siteB}` })).status).toBe(403);
	});
});
