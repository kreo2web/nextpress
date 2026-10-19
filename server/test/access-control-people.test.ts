import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listWorkableSites, readSiteAccess } from "../lib/access";
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
const created: Array<{ email: string }> = [];

beforeAll(async () => {
	app = await startAccessApp({
		createAccount: async (input) => {
			created.push({ email: input.email });
			const user = await models.users.create({ name: input.name, email: input.email, username: input.username });
			return { userId: user.id };
		},
	});
	call = callAs(app.baseUrl);
});

afterAll(async () => {
	await app.close();
});

beforeEach(async () => {
	created.length = 0;
	await seedAccessFixture();
});

const siteIds = async (userId: string): Promise<string[]> => (await listWorkableSites({ models, userId })).map((site) => site.id).sort();

describe("who works on which site", () => {
	it("gives the dashboard only to editors and above: subscribers and people with no role get no site", async () => {
		expect(await siteIds(ID.stranger)).toEqual([]);
		expect(await siteIds(ID.subscriberA)).toEqual([]);
		expect(await siteIds(ID.editorB)).toEqual([ID.siteB]);
		expect(await siteIds(ID.siteBOwner)).toEqual([ID.siteB]);
		// Main-site admins run the install, so they reach every site.
		expect(await siteIds(ID.mainAdmin)).toEqual([ID.siteA, ID.siteB].sort());
	});

	it("an editor edits content but doesn't run the site; a site owner runs only their site", async () => {
		const editor = await readSiteAccess({ models, userId: ID.editorB, siteId: ID.siteB });
		expect(editor.standing).toBe("editor");
		expect(editor.actions).toContain("edit_content");
		expect(editor.actions).not.toContain("manage_site");

		const ownerOnOther = await readSiteAccess({ models, userId: ID.siteBOwner, siteId: ID.siteA });
		expect(ownerOnOther).toMatchObject({ standing: null, actions: [], isMainSiteAdmin: false });

		const subscriber = await readSiteAccess({ models, userId: ID.subscriberA, siteId: ID.siteA });
		expect(subscriber).toMatchObject({ standing: "subscriber", actions: [] });
	});

	it("a role row the code doesn't know gives nothing", async () => {
		const custom = await models.roles.create({ name: "superuser", capabilities: [{ name: "everything" }] });
		await models.userRoles.assignRole(ID.stranger, custom.id, ID.siteA);
		expect((await readSiteAccess({ models, userId: ID.stranger, siteId: ID.siteA })).actions).toEqual([]);
	});
});

describe("people (users routes)", () => {
	it("a stranger can't list people or change anyone else", async () => {
		expect((await call({ userId: ID.stranger, path: "/api/users" })).status).toBe(403);
		const takeover = await call({ userId: ID.stranger, method: "PUT", path: `/api/users/${ID.mainOwner}`, body: { email: "mine@test.local" } });
		expect(takeover.status).toBe(404);
		expect((await models.users.findById(ID.mainOwner))?.email).toBe("main.owner@test.local");
		expect((await call({ userId: ID.stranger, method: "DELETE", path: `/api/users/${ID.editorB}` })).status).toBe(403);
	});

	it("a site owner who isn't a main-site admin can't manage install-wide people either", async () => {
		expect((await call({ userId: ID.siteBOwner, path: "/api/users" })).status).toBe(403);
		expect((await call({ userId: ID.siteBOwner, method: "DELETE", path: `/api/users/${ID.editorB}` })).status).toBe(403);
	});

	it("anyone edits their own profile, but not their own email or username", async () => {
		const own = await call({ userId: ID.editorB, method: "PUT", path: `/api/users/${ID.editorB}`, body: { name: "Ed", bio: "Writes things" } });
		expect(own.status).toBe(200);
		expect(own.body).toMatchObject({ name: "Ed", other: { bio: "Writes things" } });

		const email = await call({ userId: ID.editorB, method: "PUT", path: `/api/users/${ID.editorB}`, body: { email: "new@test.local" } });
		expect(email.status).toBe(403);
	});

	it("editors read another person's public profile only, never their email", async () => {
		const profile = await call({ userId: ID.editorB, path: `/api/users/${ID.mainOwner}` });
		expect(profile.status).toBe(200);
		expect(profile.body.name).toBe("Main Owner");
		expect(profile.body.email).toBeUndefined();
		expect((await call({ userId: ID.subscriberA, path: `/api/users/${ID.mainOwner}` })).status).toBe(404);
	});

	it("a main-site admin lists people (never with a password), adds an account with a role, and removes people", async () => {
		const list = await call({ userId: ID.mainAdmin, path: "/api/users" });
		expect(list.status).toBe(200);
		const rows = list.body.users as Array<Record<string, unknown>>;
		expect(rows.length).toBe(6);
		expect(rows.every((row) => !("password" in row))).toBe(true);

		const added = await call({
			userId: ID.mainAdmin,
			method: "POST",
			path: "/api/users",
			body: { name: "New Editor", email: "new.editor@test.local", username: "new-editor", password: "long-enough-1", siteId: ID.siteB, role: "editor" },
		});
		expect(added.status).toBe(201);
		expect(created).toEqual([{ email: "new.editor@test.local" }]);
		expect(await siteIds(String(added.body.id))).toEqual([ID.siteB]);

		const removed = await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/users/${ID.subscriberA}` });
		expect(removed.status).toBe(200);
		expect(await models.users.findById(ID.subscriberA)).toBeUndefined();
	});

	it("refuses to remove a site's owner or someone who still owns content, and removes nothing", async () => {
		const owner = await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/users/${ID.siteBOwner}` });
		expect(owner.status).toBe(409);

		await models.userRoles.assignRole(ID.stranger, ID.editorRole, ID.siteB);
		await models.posts.create({ title: "Mine", slug: "mine", blogId: ID.blogB, authorId: ID.stranger, status: "draft", blocks: [] });
		const author = await call({ userId: ID.mainAdmin, method: "DELETE", path: `/api/users/${ID.stranger}` });
		expect(author.status).toBe(409);
		expect(JSON.stringify(author.body)).not.toMatch(/delete from|query/i);
		// All or nothing: their role is still there.
		expect(await siteIds(ID.stranger)).toEqual([ID.siteB]);
	});
});

describe("site settings", () => {
	it("only the site's admins change its settings; editors and other sites' owners can't", async () => {
		const body = { general: { siteName: "Renamed" } };
		expect((await call({ userId: ID.editorB, method: "PATCH", path: `/api/settings?siteId=${ID.siteB}`, body })).status).toBe(403);
		expect((await call({ userId: ID.siteBOwner, method: "PATCH", path: `/api/settings?siteId=${ID.siteA}`, body })).status).toBe(403);
		expect((await call({ userId: ID.subscriberA, method: "PATCH", path: `/api/settings?siteId=${ID.siteA}`, body })).status).toBe(403);

		const own = await call({ userId: ID.siteBOwner, method: "PATCH", path: `/api/settings?siteId=${ID.siteB}`, body });
		expect(own.status).toBe(200);
		// Editors still read settings (the editor uses some of them).
		expect((await call({ userId: ID.editorB, path: `/api/settings?siteId=${ID.siteB}` })).status).toBe(200);
	});
});
