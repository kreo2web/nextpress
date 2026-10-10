import type { Request } from "express";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "./setup";
import {
	createMediaModel,
	createOptionModel,
	createPageModel,
	createRoleModel,
	createSiteModel,
	createThemeModel,
	createUserModel,
	createUserRoleModel,
} from "../storage";
import { createModel } from "@shared/create-models";
import { blogs as blogsTable } from "@shared/schema";
import { deleteEmptySite } from "../lib/delete-site";
import type { Deps } from "../routes/shared/deps";
import { readErrorStatus, resolveRequestSite } from "../routes/shared/resolve-request-site";
import { resolveReadSiteId } from "../lib/content-access";
import { changeSiteAddress } from "../lib/site-address";
import { createThemesRoutes } from "../routes/themes.routes";
import type { CaddyIo } from "../utils/caddy";

vi.mock("../auth", () => ({
	attachRequestAuth: vi.fn(),
	getRequestAuthUserId: vi.fn(),
	resolveRequestAuth: vi.fn(),
	getRequestAuthSiteId: (req: { authSiteId?: string }) => req.authSiteId,
}));

const ID = {
	owner: "6a0f0000-0000-4000-8000-000000000001",
	editor: "6a0f0000-0000-4000-8000-000000000002",
	stranger: "6a0f0000-0000-4000-8000-000000000003",
	main: "6a0f0000-0000-4000-8000-000000000011",
	shop: "6a0f0000-0000-4000-8000-000000000012",
	legacy: "6a0f0000-0000-4000-8000-000000000013",
	copycat: "6a0f0000-0000-4000-8000-000000000014",
	adminRole: "6a0f0000-0000-4000-8000-000000000021",
	editorRole: "6a0f0000-0000-4000-8000-000000000022",
	mainTheme: "6a0f0000-0000-4000-8000-000000000031",
	shopTheme: "6a0f0000-0000-4000-8000-000000000032",
	emptySite: "6a0f0000-0000-4000-8000-000000000041",
	busySite: "6a0f0000-0000-4000-8000-000000000042",
	busyPage: "6a0f0000-0000-4000-8000-000000000043",
};

const sites = createSiteModel(testDb);
const roles = createRoleModel(testDb);
const userRoles = createUserRoleModel(testDb);
const users = createUserModel(testDb);
const themes = createThemeModel(testDb);
const models = { sites, roles, userRoles, users, themes } as unknown as Deps["models"];

const fakeRequest = ({ siteId, authSiteId, host }: { siteId?: string; authSiteId?: string; host?: string }): Request =>
	({ query: siteId ? { siteId } : {}, body: {}, authSiteId, get: () => host }) as unknown as Request;

const acceptingCaddy = (): { io: CaddyIo; loaded: string[] } => {
	const loaded: string[] = [];
	return {
		loaded,
		io: {
			load: async (caddyfile) => {
				loaded.push(caddyfile);
				return { outcome: "accepted" };
			},
			write: async () => ({ outcome: "written" }),
		},
	};
};

const dnsPointsHere = async () => ({ valid: true, message: "ok" });

beforeAll(async () => {
	for (const [id, username] of [
		[ID.owner, "owner"],
		[ID.editor, "editor"],
		[ID.stranger, "stranger"],
	]) {
		await users.create({ id, username, email: `${username}@example.com` });
	}
	await roles.create({ id: ID.adminRole, name: "admin" });
	await roles.create({ id: ID.editorRole, name: "editor" });

	await sites.create({
		id: ID.main,
		name: "Main",
		ownerId: ID.owner,
		isDefault: true,
		siteUrl: "https://example.com",
		createdAt: new Date("2026-01-01T00:00:00Z"),
	});
	await sites.create({
		id: ID.shop,
		name: "Shop",
		ownerId: ID.owner,
		siteUrl: "https://Shop.Example.com/",
		createdAt: new Date("2026-02-01T00:00:00Z"),
	});
	await sites.create({
		id: ID.legacy,
		name: "Legacy",
		ownerId: ID.owner,
		siteUrl: null,
		settings: { general: { siteUrl: "https://legacy.com" } },
		createdAt: new Date("2026-03-01T00:00:00Z"),
	});
	await userRoles.assignRole(ID.editor, ID.editorRole, ID.shop);
});

describe("matching a visitor's domain to a site", () => {
	it("matches the www twin, old capitals/slashes, and an address kept only in Settings", async () => {
		expect((await sites.findByHostname("www.example.com"))?.id).toBe(ID.main);
		expect((await sites.findByHostname("shop.example.com"))?.id).toBe(ID.shop);
		expect((await sites.findByHostname("LEGACY.com:443"))?.id).toBe(ID.legacy);
		expect(await sites.findByHostname("unknown.com")).toBeUndefined();
	});

	it("gives a shared address to the default site, not to a newer copy", async () => {
		await sites.create({
			id: ID.copycat,
			name: "Copycat",
			ownerId: ID.owner,
			siteUrl: "https://example.com",
			createdAt: new Date("2026-04-01T00:00:00Z"),
		});
		expect((await sites.findByHostname("example.com"))?.id).toBe(ID.main);
		await sites.delete(ID.copycat);
	});
});

describe("one home for the address", () => {
	it("Settings shows the address visitors are matched by, and a settings save can't change it", async () => {
		expect((await sites.getSettings(ID.legacy)).general.siteUrl).toBe("https://legacy.com");
		await sites.updateSettings({ general: { siteUrl: "https://sneaky.com", siteName: "Legacy site" } }, ID.legacy);
		const after = await sites.getSettings(ID.legacy);
		expect(after.general.siteUrl).toBe("https://legacy.com");
		expect(after.general.siteName).toBe("Legacy site");
	});

	it("saveAddress writes the record and keeps Settings in step", async () => {
		await sites.saveAddress({ siteId: ID.legacy, address: "https://legacy.org" });
		const row = await sites.findById(ID.legacy);
		expect(row?.siteUrl).toBe("https://legacy.org");
		expect((row?.settings as { general: { siteUrl: string; siteName: string } }).general).toMatchObject({
			siteUrl: "https://legacy.org",
			siteName: "Legacy site",
		});
	});
});

describe("which site a signed-in request acts on", () => {
	it("uses the site the request names", async () => {
		const site = await resolveRequestSite({ models, req: fakeRequest({ siteId: ID.shop }), userId: ID.owner });
		expect(site.id).toBe(ID.shop);
	});

	it("refuses a request that names no site instead of using the default site", async () => {
		const err = await resolveRequestSite({ models, req: fakeRequest({}), userId: ID.owner }).catch((error: Error) => error);
		expect(err).toBeInstanceOf(Error);
		expect(readErrorStatus(err as Error)).toBe(400);
		expect((err as Error).message).toBe("Pick a site first.");
	});

	it("uses an API key's own site when the request names none (pages made through MCP)", async () => {
		const site = await resolveRequestSite({ models, req: fakeRequest({ authSiteId: ID.shop }), userId: ID.owner });
		expect(site.id).toBe(ID.shop);
	});

	it("refuses a key asking for another site, and a user asking for a site they can't use", async () => {
		const keyErr = await resolveRequestSite({
			models,
			req: fakeRequest({ siteId: ID.main, authSiteId: ID.shop }),
			userId: ID.owner,
		}).catch((error: Error) => error);
		expect(readErrorStatus(keyErr as Error)).toBe(403);

		const strangerErr = await resolveRequestSite({ models, req: fakeRequest({ siteId: ID.shop }), userId: ID.stranger }).catch(
			(error: Error) => error,
		);
		expect(readErrorStatus(strangerErr as Error)).toBe(403);
	});
});

describe("which site a public read is about", () => {
	it("uses the named site, then the key's site, then the site of the domain", async () => {
		expect(await resolveReadSiteId({ req: fakeRequest({ host: "example.com" }), models, requestedSiteId: ID.shop })).toBe(ID.shop);
		expect(await resolveReadSiteId({ req: fakeRequest({ authSiteId: ID.legacy, host: "example.com" }), models })).toBe(ID.legacy);
		expect(await resolveReadSiteId({ req: fakeRequest({ host: "shop.example.com" }), models })).toBe(ID.shop);
		expect(await resolveReadSiteId({ req: fakeRequest({ host: "elsewhere.com" }), models })).toBe(ID.main);
		expect(await resolveReadSiteId({ req: fakeRequest({ host: "shop.example.com" }), models, requestedSiteId: "nope" })).toBe(ID.shop);
	});
});

describe("changing a site's address", () => {
	it("refuses an address another site already answers on (www twin included)", async () => {
		const result = await changeSiteAddress({
			models,
			userId: ID.owner,
			siteId: ID.shop,
			input: "www.example.com",
			checkDns: dnsPointsHere,
			caddyIo: acceptingCaddy().io,
		});
		expect(result).toMatchObject({ ok: false, statusCode: 409 });
		if (!result.ok) expect(result.message).toContain("Main");
	});

	it("lets a non-admin re-send the address they were shown, but not change it", async () => {
		const same = await changeSiteAddress({
			models,
			userId: ID.editor,
			siteId: ID.shop,
			input: "https://shop.example.com",
			checkDns: dnsPointsHere,
			caddyIo: acceptingCaddy().io,
		});
		expect(same).toEqual({ ok: true, address: "https://shop.example.com", changed: false, notice: null });

		const changed = await changeSiteAddress({
			models,
			userId: ID.editor,
			siteId: ID.shop,
			input: "https://store.example.com",
			checkDns: dnsPointsHere,
			caddyIo: acceptingCaddy().io,
		});
		expect(changed).toMatchObject({ ok: false, statusCode: 403 });
	});

	it("refuses a domain that doesn't point here yet, checking only the main domain", async () => {
		const asked: string[] = [];
		const result = await changeSiteAddress({
			models,
			userId: ID.owner,
			siteId: ID.shop,
			input: "store.example.com",
			checkDns: async (host) => {
				asked.push(host);
				return { valid: false, message: `"${host}" doesn't point to this server yet.` };
			},
			caddyIo: acceptingCaddy().io,
		});
		expect(result).toMatchObject({ ok: false, statusCode: 400 });
		expect(asked).toEqual(["store.example.com"]);
	});

	it("saves both copies and hands the web server every site's address", async () => {
		const caddy = acceptingCaddy();
		const result = await changeSiteAddress({
			models,
			userId: ID.owner,
			siteId: ID.shop,
			input: "Store.Example.com/",
			checkDns: dnsPointsHere,
			caddyIo: caddy.io,
		});
		expect(result).toEqual({ ok: true, address: "https://store.example.com", changed: true, notice: null });
		expect((await sites.findById(ID.shop))?.siteUrl).toBe("https://store.example.com");
		expect((await sites.getSettings(ID.shop)).general.siteUrl).toBe("https://store.example.com");
		expect(caddy.loaded[0]).toContain("example.com, www.example.com, store.example.com, legacy.org, www.legacy.org {");
	});

	it("skips the DNS check for localhost addresses", async () => {
		const result = await changeSiteAddress({
			models,
			userId: ID.owner,
			siteId: ID.legacy,
			input: "site2.localhost:5000",
			checkDns: async () => {
				throw new Error("DNS should not be asked about localhost");
			},
			caddyIo: acceptingCaddy().io,
		});
		expect(result).toMatchObject({ ok: true, address: "http://site2.localhost:5000", changed: true });
	});
});

describe("themes belong to one site", () => {
	let server: Server;
	let base = "";

	beforeAll(async () => {
		await themes.create({ id: ID.mainTheme, name: "Main look", authorId: ID.owner, version: "1", requires: "1", status: "active" });
		await themes.create({ id: ID.shopTheme, name: "Shop look", authorId: ID.owner, version: "1", requires: "1", status: "inactive" });
		await sites.update(ID.main, { activeThemeId: ID.mainTheme });

		const app = express();
		app.use(express.json());
		const deps = {
			models,
			requireAuth: (req: Request, _res: express.Response, next: express.NextFunction) => {
				Object.assign(req, { authUserId: ID.owner });
				next();
			},
			authService: { getCurrentUserId: (req: Request) => (req as Request & { authUserId?: string }).authUserId ?? null },
			hooks: { doAction: () => undefined, getActions: () => ({}), getFilters: () => ({}) },
		} as unknown as Deps;
		app.use("/api", createThemesRoutes(deps));
		server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it("switching the shop's theme leaves the main site's theme alone", async () => {
		const response = await fetch(`${base}/api/themes/${ID.shopTheme}/activate?siteId=${ID.shop}`, { method: "POST" });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ id: ID.shopTheme, siteId: ID.shop, status: "active" });

		expect((await sites.findById(ID.shop))?.activeThemeId).toBe(ID.shopTheme);
		expect((await sites.findById(ID.main))?.activeThemeId).toBe(ID.mainTheme);
		expect((await themes.findById(ID.mainTheme))?.status).toBe("active");
	});

	it("refuses to switch a theme without naming a site", async () => {
		const response = await fetch(`${base}/api/themes/${ID.shopTheme}/activate`, { method: "POST" });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ message: "Pick a site first." });
	});

	it("reports the active theme per site", async () => {
		const shop = await (await fetch(`${base}/api/themes/active?siteId=${ID.shop}`)).json();
		const main = await (await fetch(`${base}/api/themes/active?siteId=${ID.main}`)).json();
		expect(shop).toMatchObject({ id: ID.shopTheme, siteId: ID.shop });
		expect(main).toMatchObject({ id: ID.mainTheme, siteId: ID.main });
	});
});

describe("deleting a site", () => {
	const pages = createPageModel(testDb);
	const options = createOptionModel(testDb);
	const deleteModels = {
		sites,
		roles,
		userRoles,
		pages,
		options,
		blogs: createModel(blogsTable, testDb),
		media: createMediaModel(testDb),
		formSubmissions: { findManyWhere: async () => [], delete: async () => undefined },
	} as unknown as Parameters<typeof deleteEmptySite>[0]["models"];

	beforeAll(async () => {
		await sites.create({ id: ID.emptySite, name: "Empty", ownerId: ID.owner });
		await userRoles.assignRole(ID.owner, ID.adminRole, ID.emptySite);
		await options.setOption({ name: "homepage_page_slug", value: "home", siteId: ID.emptySite });

		await sites.create({ id: ID.busySite, name: "Busy", ownerId: ID.owner });
		await pages.create({ id: ID.busyPage, title: "About", slug: "about", siteId: ID.busySite, authorId: ID.owner });
	});

	it("keeps a site that still has pages and says what to move first", async () => {
		const result = await deleteEmptySite({ models: deleteModels, siteId: ID.busySite });
		expect(result).toMatchObject({ ok: false, statusCode: 409 });
		if (!result.ok) expect(result.message).toContain("1 page");
		expect(await sites.findById(ID.busySite)).toBeDefined();
	});

	it("deletes an empty site together with its role assignments and options", async () => {
		expect(await deleteEmptySite({ models: deleteModels, siteId: ID.emptySite })).toEqual({ ok: true });
		expect(await sites.findById(ID.emptySite)).toBeUndefined();
		expect(await userRoles.findBySite(ID.emptySite)).toEqual([]);
		expect(await options.getOption("homepage_page_slug", ID.emptySite)).toBeUndefined();
	});
});
