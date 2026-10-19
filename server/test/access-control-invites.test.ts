import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
let failNextAccount = false;

// A fresh app per test: joining is limited per visitor, and each test joins a few times.
beforeEach(async () => {
	await seedAccessFixture();
	failNextAccount = false;
	app = await startAccessApp({
		createAccount: async (input) => {
			if (failNextAccount) throw new Error("Better Auth said no");
			const user = await models.users.create({ name: input.name, email: input.email, username: input.username });
			return { userId: user.id };
		},
	});
	call = callAs(app.baseUrl);
});

afterEach(async () => {
	await app.close();
});

const makeLink = (userId: string, body: object) => call({ userId, method: "POST", path: "/api/invites", body });
const joiner = (n: number) => ({ name: `Joiner ${n}`, email: `joiner${n}@test.local`, username: `joiner-${n}`, password: "long-enough-1" });
const codeOf = (link: { body: Record<string, unknown> }): string => String(link.body.code);

describe("making invite links", () => {
	it("only a site's admins make links for it, and never above their own role", async () => {
		expect((await makeLink(ID.editorB, { siteId: ID.siteB, role: "editor", maxUses: 1, expiresInDays: 7 })).status).toBe(403);
		expect((await makeLink(ID.siteBOwner, { siteId: ID.siteA, role: "editor", maxUses: 1, expiresInDays: 7 })).status).toBe(403);

		const admin = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "admin", maxUses: null, expiresInDays: null, note: "Agency" });
		expect(admin.status).toBe(201);
		expect(admin.body).toMatchObject({ role: "admin", placesLeft: null, expiresAt: null, state: "open", note: "Agency" });
		expect(String(admin.body.path)).toMatch(/^\/join\/[A-Za-z0-9_-]{24}$/);
	});

	it("lists a site's links only to that site's admins, and cancelling closes a link", async () => {
		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 3, expiresInDays: 7 });
		expect((await call({ userId: ID.editorB, path: `/api/invites?siteId=${ID.siteB}` })).status).toBe(403);
		const list = await call({ userId: ID.siteBOwner, path: `/api/invites?siteId=${ID.siteB}` });
		expect((list.body.invites as unknown[]).length).toBe(1);

		expect((await call({ userId: ID.mainOwner, method: "DELETE", path: `/api/invites/${link.body.id}` })).status).toBe(200);
		const view = await call({ userId: null, path: `/api/invites/code/${codeOf(link)}` });
		expect(view.body.state).toBe("cancelled");
		const join = await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(1) });
		expect(join.status).toBe(410);
		expect(String(join.body.message)).toMatch(/cancelled/);
	});
});

describe("joining through a link", () => {
	it("gives exactly the link's role on exactly its site, until the places run out", async () => {
		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 2, expiresInDays: 7 });
		expect((await call({ userId: null, path: `/api/invites/code/${codeOf(link)}` })).body).toMatchObject({ siteName: "Site B", role: "editor", placesLeft: 2, state: "open" });

		const first = await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(1) });
		expect(first.status).toBe(201);
		expect(first.body).toMatchObject({ siteId: ID.siteB, role: "editor", createdAccount: true });
		const joined = await models.users.findByEmail("joiner1@test.local");
		expect((await listWorkableSites({ models, userId: String(joined?.id) })).map((site) => site.id)).toEqual([ID.siteB]);

		expect((await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(2) })).status).toBe(201);
		const third = await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(3) });
		expect(third.status).toBe(410);
		expect(String(third.body.message)).toMatch(/no places left/);
	});

	it("two people opening a link with one place left can't both get it", async () => {
		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 1, expiresInDays: 7 });
		const results = await Promise.all([1, 2, 3].map((n) => call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(n) })));
		expect(results.filter((result) => result.status === 201)).toHaveLength(1);
		expect((await models.invites.findById(String(link.body.id)))?.uses).toBe(1);
	});

	it("the place itself is claimed in one step: with one place, only one of many claims at once wins", async () => {
		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 1, expiresInDays: 7 });
		const claims = await Promise.all([1, 2, 3, 4].map(() => models.invites.claimPlace(codeOf(link))));
		expect(claims.filter(Boolean)).toHaveLength(1);
		expect((await models.invites.findById(String(link.body.id)))?.uses).toBe(1);
	});

	it("an ended link explains itself, and a link that fails to make the account gives its place back", async () => {
		const ended = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 5, expiresInDays: 1 });
		await models.invites.update(String(ended.body.id), { expiresAt: new Date(Date.now() - 1000) });
		const late = await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(ended)}/join`, body: joiner(1) });
		expect(late.status).toBe(410);
		expect(String(late.body.message)).toMatch(/ended/);

		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 1, expiresInDays: 7 });
		failNextAccount = true;
		expect((await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: joiner(2) })).status).toBe(500);
		expect((await models.invites.findById(String(link.body.id)))?.uses).toBe(0);
	});

	it("a signed-in person gains the role; someone who already stands higher keeps theirs and uses no place", async () => {
		const link = await makeLink(ID.mainAdmin, { siteId: ID.siteA, role: "editor", maxUses: 1, expiresInDays: 7 });
		const already = await call({ userId: ID.mainAdmin, method: "POST", path: `/api/invites/code/${codeOf(link)}/join` });
		expect(already.status).toBe(201);
		expect((await models.invites.findById(String(link.body.id)))?.uses).toBe(0);

		expect((await call({ userId: ID.subscriberA, method: "POST", path: `/api/invites/code/${codeOf(link)}/join` })).status).toBe(201);
		expect((await readSiteAccess({ models, userId: ID.subscriberA, siteId: ID.siteA })).standing).toBe("editor");
	});

	it("an email that already has an account is sent to sign in first", async () => {
		const link = await makeLink(ID.siteBOwner, { siteId: ID.siteB, role: "editor", maxUses: 1, expiresInDays: 7 });
		const taken = await call({ userId: null, method: "POST", path: `/api/invites/code/${codeOf(link)}/join`, body: { ...joiner(1), email: "stranger@test.local" } });
		expect(taken.status).toBe(409);
		expect(String(taken.body.message)).toMatch(/Sign in/);
	});
});

describe("people on a site", () => {
	it("a site admin changes and removes roles on their own site; editors can't", async () => {
		const list = await call({ userId: ID.siteBOwner, path: `/api/site-people?siteId=${ID.siteB}` });
		expect((list.body.people as Array<{ userId: string; standing: string }>).map((person) => [person.userId, person.standing]).sort()).toEqual(
			[[ID.editorB, "editor"], [ID.siteBOwner, "owner"]].sort(),
		);
		expect((await call({ userId: ID.editorB, path: `/api/site-people?siteId=${ID.siteB}` })).status).toBe(403);

		const demoted = await call({ userId: ID.siteBOwner, method: "PUT", path: `/api/site-people/${ID.editorB}`, body: { siteId: ID.siteB, role: "subscriber" } });
		expect(demoted.status).toBe(200);
		expect(await listWorkableSites({ models, userId: ID.editorB })).toEqual([]);

		expect((await call({ userId: ID.siteBOwner, method: "DELETE", path: `/api/site-people/${ID.editorB}?siteId=${ID.siteB}` })).status).toBe(200);
		expect((await readSiteAccess({ models, userId: ID.editorB, siteId: ID.siteB })).standing).toBeNull();
	});

	it("nobody changes the owner or their own role, and admins of other sites can't touch this one", async () => {
		expect((await call({ userId: ID.mainAdmin, method: "PUT", path: `/api/site-people/${ID.siteBOwner}`, body: { siteId: ID.siteB, role: "editor" } })).status).toBe(400);
		expect((await call({ userId: ID.siteBOwner, method: "PUT", path: `/api/site-people/${ID.siteBOwner}`, body: { siteId: ID.siteB, role: "editor" } })).status).toBe(400);
		expect((await call({ userId: ID.siteBOwner, method: "PUT", path: `/api/site-people/${ID.mainAdmin}`, body: { siteId: ID.siteA, role: "editor" } })).status).toBe(403);
	});
});
