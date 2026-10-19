import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import multer from "multer";
import { sql } from "drizzle-orm";
import { blogs, comments, media, options, pages, posts, roles, sites, themes, userRoles, users } from "@shared/schema";
import { createModel } from "@shared/create-models";
import { getZodSchema } from "@shared/zod-schema";
import { testDb } from "../setup";
import {
	createCommentModel,
	createMediaModel,
	createOptionModel,
	createPageModel,
	createPluginModel,
	createPostModel,
	createRoleModel,
	createSiteModel,
	createTemplateModel,
	createThemeModel,
	createUserModel,
	createUserRoleModel,
} from "../../storage";
import { authService, requireAuth } from "../../auth";
import { createInviteModel } from "../../lib/invites/invite-model";
import { createInviteService } from "../../lib/invites/invite-service";
import { createInvitesRoutes } from "../../routes/invites.routes";
import { createSitePeopleRoutes } from "../../routes/site-people.routes";
import { CONFIG, getSiteSettings, parsePaginationParams, parseStatusParam } from "../../config";
import type { Deps } from "../../routes/shared/deps";
import { createBlogsRoutes } from "../../routes/blogs.routes";
import { createCommentsRoutes } from "../../routes/comments.routes";
import { createMediaRoutes } from "../../routes/media.routes";
import { createOptionsRoutes } from "../../routes/options.routes";
import { createPluginsRoutes } from "../../routes/plugins.routes";
import { createPostsRoutes } from "../../routes/posts.routes";
import { createSettingsRoutes } from "../../routes/settings.routes";
import { createThemesRoutes } from "../../routes/themes.routes";
import { createUsersRoutes, type CreateAccount } from "../../routes/users.routes";

/**
 * Two sites and six people for access tests. Site A is the main (default) site.
 * Requests sign in with the `x-test-user` header; the test file mocks Better Auth's session lookup to read it.
 */
export const ID = {
	mainOwner: "a0000000-0000-4000-8000-000000000001",
	mainAdmin: "a0000000-0000-4000-8000-000000000002",
	siteBOwner: "a0000000-0000-4000-8000-000000000003",
	editorB: "a0000000-0000-4000-8000-000000000004",
	subscriberA: "a0000000-0000-4000-8000-000000000005",
	stranger: "a0000000-0000-4000-8000-000000000006",
	siteA: "b0000000-0000-4000-8000-000000000001",
	siteB: "b0000000-0000-4000-8000-000000000002",
	adminRole: "c0000000-0000-4000-8000-000000000001",
	editorRole: "c0000000-0000-4000-8000-000000000002",
	subscriberRole: "c0000000-0000-4000-8000-000000000003",
	blogA: "d0000000-0000-4000-8000-000000000001",
	blogB: "d0000000-0000-4000-8000-000000000002",
	pageA: "e0000000-0000-4000-8000-000000000001",
	pageB: "e0000000-0000-4000-8000-000000000002",
	postA: "f0000000-0000-4000-8000-000000000001",
	postB: "f0000000-0000-4000-8000-000000000002",
	mediaA: "10000000-0000-4000-8000-000000000001",
	commentA: "20000000-0000-4000-8000-000000000001",
	sharedTheme: "30000000-0000-4000-8000-000000000001",
	themeB: "30000000-0000-4000-8000-000000000002",
} as const;

export const models = {
	sites: createSiteModel(testDb),
	roles: createRoleModel(testDb),
	userRoles: createUserRoleModel(testDb),
	users: createUserModel(testDb),
	pages: createPageModel(testDb),
	posts: createPostModel(testDb),
	blogs: createModel(blogs, testDb),
	media: createMediaModel(testDb),
	comments: createCommentModel(testDb),
	options: createOptionModel(testDb),
	plugins: createPluginModel(testDb),
	templates: createTemplateModel(testDb),
	themes: createThemeModel(testDb),
	invites: createInviteModel(testDb),
} as unknown as Deps["models"];

const person = (id: string, name: string) => ({ id, name, username: name.toLowerCase().replace(/\s+/g, "-"), email: `${name.toLowerCase().replace(/\s+/g, ".")}@test.local` });

/** Wipes and seeds the tables the access tests use. Every value a test checks is set up here. */
export async function seedAccessFixture(): Promise<void> {
	await testDb.execute(sql`TRUNCATE invites, comments, posts, blogs, media, options, user_roles, roles, pages, sites, themes, plugins, users CASCADE`);
	await testDb.insert(users).values([
		person(ID.mainOwner, "Main Owner"),
		person(ID.mainAdmin, "Main Admin"),
		person(ID.siteBOwner, "Site B Owner"),
		person(ID.editorB, "Editor B"),
		person(ID.subscriberA, "Subscriber A"),
		person(ID.stranger, "Stranger"),
	]);
	await testDb.insert(themes).values([
		{ id: ID.sharedTheme, name: "Shared", authorId: ID.siteBOwner, version: "1.0.0", requires: "1.0.0", settings: {} },
		{ id: ID.themeB, name: "Only B", authorId: ID.siteBOwner, version: "1.0.0", requires: "1.0.0", settings: {} },
	]);
	await testDb.insert(sites).values([
		{ id: ID.siteA, name: "Site A", ownerId: ID.mainOwner, isDefault: true, siteUrl: "http://site-a.localhost", activeThemeId: ID.sharedTheme, settings: {} },
		{ id: ID.siteB, name: "Site B", ownerId: ID.siteBOwner, isDefault: false, siteUrl: "http://site-b.localhost", activeThemeId: ID.sharedTheme, settings: {} },
	]);
	await testDb.insert(roles).values([
		{ id: ID.adminRole, name: "admin", capabilities: [] },
		{ id: ID.editorRole, name: "editor", capabilities: [] },
		{ id: ID.subscriberRole, name: "subscriber", capabilities: [] },
	]);
	await testDb.insert(userRoles).values([
		{ userId: ID.mainAdmin, roleId: ID.adminRole, siteId: ID.siteA },
		{ userId: ID.editorB, roleId: ID.editorRole, siteId: ID.siteB },
		{ userId: ID.subscriberA, roleId: ID.subscriberRole, siteId: ID.siteA },
	]);
	await testDb.insert(pages).values([
		{ id: ID.pageA, title: "Blog A", slug: "blog-a", siteId: ID.siteA, authorId: ID.mainOwner, status: "draft", blocks: [] },
		{ id: ID.pageB, title: "Blog B", slug: "blog-b", siteId: ID.siteB, authorId: ID.siteBOwner, status: "draft", blocks: [] },
	]);
	await testDb.insert(blogs).values([
		{ id: ID.blogA, name: "Blog A", slug: "a", siteId: ID.siteA, authorId: ID.mainOwner, pageId: ID.pageA, status: "publish" },
		{ id: ID.blogB, name: "Blog B", slug: "b", siteId: ID.siteB, authorId: ID.siteBOwner, pageId: ID.pageB, status: "draft" },
	]);
	await testDb.insert(posts).values([
		{ id: ID.postA, title: "Hello A", slug: "hello-a", blogId: ID.blogA, authorId: ID.mainOwner, status: "publish", blocks: [] },
		{ id: ID.postB, title: "Hello B", slug: "hello-b", blogId: ID.blogB, authorId: ID.siteBOwner, status: "publish", blocks: [] },
	]);
	await testDb.insert(media).values([
		{ id: ID.mediaA, filename: "a.png", originalName: "a.png", mimeType: "image/png", size: 10, url: "/uploads/a.png", siteId: ID.siteA, authorId: ID.mainOwner },
	]);
	await testDb.insert(comments).values([
		{ id: ID.commentA, postId: ID.postA, content: "Waiting for review", authorName: "Visitor", authorEmail: "visitor@test.local", status: "pending" },
	]);
	await testDb.insert(options).values([
		{ name: "homepage_page_slug", value: "home", siteId: ID.siteA },
		{ name: "plugin_secret", value: "do-not-show", siteId: ID.siteA },
	]);
}

const stubHooks = { doAction: () => undefined, applyFilters: (_name: string, value: unknown) => value } as unknown as Deps["hooks"];

export type AccessApp = { baseUrl: string; uploadDir: string; close: () => Promise<void> };

/** The real route factories on the test database, behind the real sign-in check. */
export async function startAccessApp({ createAccount }: { createAccount?: CreateAccount } = {}): Promise<AccessApp> {
	const uploadDir = mkdtempSync(path.join(tmpdir(), "np-access-uploads-"));
	const deps = {
		models,
		hooks: stubHooks,
		authService,
		requireAuth,
		CONFIG,
		parsePaginationParams,
		parseStatusParam,
		getSiteSettings,
		schemas: {
			posts: getZodSchema("posts"),
			pages: getZodSchema("pages"),
			comments: getZodSchema("comments"),
			media: getZodSchema("media"),
			templates: getZodSchema("templates"),
			users: getZodSchema("users"),
			blogs: getZodSchema("blogs"),
		},
		upload: multer({ dest: uploadDir }),
		uploadDir,
	} as unknown as Deps;

	const app = express();
	app.use(express.json());
	app.use("/api/users", createUsersRoutes(deps, { createAccount }));
	app.use("/api/site-people", createSitePeopleRoutes(deps));
	if (createAccount) app.use("/api/invites", createInvitesRoutes({ ...deps, invites: createInviteService({ models, createAccount }) }));
	app.use("/api/blogs", createBlogsRoutes(deps));
	app.use("/api/posts", createPostsRoutes(deps));
	app.use("/api/comments", createCommentsRoutes(deps));
	app.use("/api/media", createMediaRoutes(deps));
	app.use("/api/settings", createSettingsRoutes(deps));
	app.use("/api/options", createOptionsRoutes(deps));
	app.use("/api", createThemesRoutes(deps));
	app.use("/api", createPluginsRoutes(deps));
	app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err.statusCode ?? 500).json({ message: err.message });
	});

	const server: Server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return {
		baseUrl: `http://127.0.0.1:${port}`,
		uploadDir,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

/** A request as `userId` (or as a signed-out visitor when null). */
export const callAs =
	(baseUrl: string) =>
	async ({ userId, method = "GET", path: url, body }: { userId: string | null; method?: string; path: string; body?: object }) => {
		const response = await fetch(`${baseUrl}${url}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				...(userId ? { "x-test-user": userId } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		const text = await response.text();
		return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
	};
