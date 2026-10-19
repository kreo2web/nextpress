import express from "express";
import { inspect } from "node:util";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { options as optionsTable } from "@shared/schema";
import { testDb } from "./setup";
import {
	createOptionModel,
	createRoleModel,
	createSiteModel,
	createUserModel,
	createUserRoleModel,
} from "../storage";
import { BUILT_IN_AUTH_SECRET, isBuiltInAuthSecret } from "../config";
import { buildTestModels } from "../transfer/test-fixtures";
import { createTransferExporter } from "../transfer/export-data";
import { apiKeyScopeEnforcer } from "../middleware/api-key-scope-enforcer";
import { authService, requireAuth, requireSessionAuth } from "../auth";
import { createAiBuilderRoutes } from "../routes/ai-builder.routes";
import { createOptionsRoutes } from "../routes/options.routes";
import type { Deps } from "../routes/shared/deps";
import {
	createAiSettingsService,
	type AiSettingsService,
	type ResolveDns,
	type TestAiConnection,
} from "../lib/ai-builder";

const API_KEY = vi.hoisted(() => "npk_live_test-key-for-the-settings-routes");
const KEY_WITHOUT_SETTINGS_SCOPE = vi.hoisted(() => "npk_live_test-key-without-settings-scope");

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

vi.mock("../lib/sdk-auth", () => ({
	verifyApiKey: async (token: string) => {
		const owner = "6b1f0000-0000-4000-8000-000000000002";
		const site = "6b1f0000-0000-4000-8000-000000000012";
		if (token === API_KEY) return { id: "key-1", userId: owner, siteId: site, scopes: ["settings:read", "settings:write"] };
		if (token === KEY_WITHOUT_SETTINGS_SCOPE) return { id: "key-2", userId: owner, siteId: site, scopes: ["pages:read"] };
		return null;
	},
}));

const ID = {
	mainOwner: "6b1f0000-0000-4000-8000-000000000001",
	clientOwner: "6b1f0000-0000-4000-8000-000000000002",
	mainAdmin: "6b1f0000-0000-4000-8000-000000000003",
	clientAdmin: "6b1f0000-0000-4000-8000-000000000004",
	editor: "6b1f0000-0000-4000-8000-000000000005",
	outsider: "6b1f0000-0000-4000-8000-000000000006",
	main: "6b1f0000-0000-4000-8000-000000000011",
	client: "6b1f0000-0000-4000-8000-000000000012",
	adminRole: "6b1f0000-0000-4000-8000-000000000021",
	editorRole: "6b1f0000-0000-4000-8000-000000000022",
};

const RAW_KEY = "sk-live-9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const OTHER_KEY = "sk-live-0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const SERVER_SECRET = "a-long-random-server-secret-for-this-test";
const FIXED_NOW = new Date("2026-10-17T09:00:00.000Z");

const sites = createSiteModel(testDb);
const roles = createRoleModel(testDb);
const userRoles = createUserRoleModel(testDb);
const users = createUserModel(testDb);
const optionModel = createOptionModel(testDb);
const models = { sites, roles, userRoles, users, options: optionModel } as unknown as Deps["models"];

const dnsTable = new Map<string, string[] | Error>();
const resolveDns: ResolveDns = async (hostname) => {
	const hit = dnsTable.get(hostname);
	if (!hit) throw new Error(`getaddrinfo ENOTFOUND ${hostname}`);
	if (hit instanceof Error) throw hit;
	return hit;
};

/** Everything the server prints while a test runs, so a test can prove the key is not in it. */
const logged: string[] = [];

type CallParams = {
	method?: "GET" | "PUT" | "DELETE" | "POST";
	path: string;
	user?: string;
	body?: Record<string, string | undefined>;
	headers?: Record<string, string>;
};

type Reply = { status: number; json: Record<string, string | boolean | null | undefined>; text: string };

let server: Server;
let baseUrl: string;
let service: AiSettingsService;

const startApp = async ({
	secret = SERVER_SECRET,
	isProduction = false,
	testConnection,
}: { secret?: string; isProduction?: boolean; testConnection?: TestAiConnection } = {}): Promise<void> => {
	service = createAiSettingsService({
		models,
		getSecret: () => secret,
		isProduction,
		resolveDns,
		now: () => FIXED_NOW,
		testConnection,
	});
	const app = express();
	app.use(express.json());
	app.use(apiKeyScopeEnforcer);
	app.use(
		"/api/ai-builder",
		createAiBuilderRoutes({
			models,
			requireSession: requireSessionAuth,
			getUserId: (req) => authService.getCurrentUserId(req),
			service,
		}),
	);
	app.use("/api/options", createOptionsRoutes({ models, requireAuth, authService } as unknown as Deps));
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const stopApp = (): Promise<void> => new Promise<void>((resolve) => server.close(() => resolve()));

const call = async ({ method = "GET", path, user, body, headers = {} }: CallParams): Promise<Reply> => {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}), ...headers },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	return { status: res.status, json: text.startsWith("{") ? JSON.parse(text) : {}, text };
};

const settingsPath = (siteId: string): string => `/api/ai-builder/settings?siteId=${siteId}`;
const getSettings = (user: string | undefined, siteId = ID.client) => call({ path: settingsPath(siteId), user });
const getStatus = (user: string | undefined, siteId = ID.client) => call({ path: `/api/ai-builder/status?siteId=${siteId}`, user });
const removeSettings = (user: string | undefined, siteId = ID.client) => call({ method: "DELETE", path: settingsPath(siteId), user });
const putSettings = (user: string | undefined, body: Record<string, string | undefined>) =>
	call({ method: "PUT", path: "/api/ai-builder/settings", user, body: { siteId: ID.client, ...body } });

const saveClaude = (user = ID.clientAdmin, extra: Record<string, string | undefined> = {}) =>
	putSettings(user, { provider: "anthropic", model: "claude-sonnet-5-5", apiKey: RAW_KEY, ...extra });

const saveCompatible = (user: string, baseUrl: string, extra: Record<string, string | undefined> = {}) =>
	putSettings(user, { provider: "openai-compatible", model: "llama3.1:8b", baseUrl, apiKey: RAW_KEY, ...extra });

const readStoredRow = async (siteId = ID.client) => {
	const row = await optionModel.getOption("ai_builder", siteId);
	return row
		? (JSON.parse(row.value) as {
				key: { v: number; iv: string; tag: string; data: string } | null;
				keyEnding: string | null;
				updatedBy: string;
				model: string;
			})
		: null;
};

beforeAll(async () => {
	for (const [id, username] of [
		[ID.mainOwner, "main-owner"],
		[ID.clientOwner, "client-owner"],
		[ID.mainAdmin, "main-admin"],
		[ID.clientAdmin, "client-admin"],
		[ID.editor, "editor"],
		[ID.outsider, "outsider"],
	]) {
		await users.create({ id, username, email: `${username}@example.com` });
	}
	await roles.create({ id: ID.adminRole, name: "admin" });
	await roles.create({ id: ID.editorRole, name: "editor" });
	await sites.create({ id: ID.main, name: "Main", ownerId: ID.mainOwner, isDefault: true, siteUrl: "https://example.com" });
	await sites.create({ id: ID.client, name: "Client", ownerId: ID.clientOwner, siteUrl: "https://client.example.com" });
	await userRoles.assignRole(ID.mainAdmin, ID.adminRole, ID.main);
	await userRoles.assignRole(ID.mainAdmin, ID.adminRole, ID.client);
	await userRoles.assignRole(ID.clientAdmin, ID.adminRole, ID.client);
	await userRoles.assignRole(ID.editor, ID.editorRole, ID.client);
});

beforeEach(async () => {
	await testDb.delete(optionsTable);
	dnsTable.clear();
	logged.length = 0;
	for (const method of ["log", "info", "warn", "error", "debug"] as const) {
		vi.spyOn(console, method).mockImplementation((...args) => {
			logged.push(inspect(args, { depth: 8 }));
		});
	}
	await startApp();
});

afterEach(async () => {
	await stopApp();
	vi.restoreAllMocks();
});

describe("the key stays on the server", () => {
	it("is in no answer from any route and nowhere in the log, and is stored locked", async () => {
		const replies = [
			await saveClaude(),
			await getSettings(ID.clientAdmin),
			await getStatus(ID.clientAdmin),
			await getStatus(ID.editor),
			await call({ path: `/api/options/ai_builder?siteId=${ID.client}` }),
			await call({ method: "POST", path: "/api/options", user: ID.clientAdmin, body: { siteId: ID.client, name: "ai_builder", value: RAW_KEY } }),
			await putSettings(ID.clientAdmin, { provider: "anthropic", model: "", apiKey: RAW_KEY }),
			await saveCompatible(ID.clientAdmin, "http://localhost:11434/v1"),
			await saveCompatible(ID.clientAdmin, "https://nowhere.example.com/v1"),
			await putSettings(ID.editor, { provider: "anthropic", model: "claude-sonnet-5-5", apiKey: RAW_KEY }),
			await call({ method: "PUT", path: "/api/ai-builder/settings", headers: { authorization: `Bearer ${API_KEY}` }, body: { siteId: ID.client, provider: "anthropic", model: "m", apiKey: RAW_KEY } }),
		];
		expect(replies[0]?.status).toBe(200);

		const row = await readStoredRow();
		if (!row?.key) throw new Error("the save should have stored a locked key");
		expect(row.key).toMatchObject({ v: 1 });
		expect(row.keyEnding).toBe(RAW_KEY.slice(-4));
		const rawRow = (await optionModel.getOption("ai_builder", ID.client))?.value ?? "";
		expect(rawRow).not.toContain(RAW_KEY);

		for (const reply of replies) {
			expect(reply.text).not.toContain(RAW_KEY);
			expect(reply.text).not.toContain(row.key.data);
			expect(reply.text).not.toContain(row.key.iv);
			expect(reply.text).not.toContain(row.key.tag);
		}
		expect(logged.length).toBeGreaterThan(0);
		for (const line of logged) {
			expect(line).not.toContain(RAW_KEY);
		}
	});

	it("shows only whether a key is saved and how it ends", async () => {
		expect(await getSettings(ID.clientAdmin)).toMatchObject({ status: 200, json: { configured: false } });
		const saved = await saveClaude();
		expect(saved.json).toEqual({
			configured: true,
			provider: "anthropic",
			model: "claude-sonnet-5-5",
			baseUrl: null,
			hasKey: true,
			keyEnding: RAW_KEY.slice(-4),
			keyUnreadable: false,
			updatedAt: FIXED_NOW.toISOString(),
		});
		expect((await getSettings(ID.clientAdmin)).json).toEqual(saved.json);
	});

	it("is opened for the assistant only through the server-side loader", async () => {
		await saveClaude(ID.clientAdmin);
		expect(await service.loadForUse({ siteId: ID.client })).toEqual({
			ok: true,
			settings: { provider: "anthropic", model: "claude-sonnet-5-5", baseUrl: null, apiKey: RAW_KEY, updatedBy: ID.clientAdmin },
		});
		expect(await service.loadForUse({ siteId: ID.main })).toEqual({ ok: false, reason: "not_configured" });
	});
});

describe("when the server's sign-in secret changes", () => {
	it("says the key can't be read and asks for it again, without crashing or showing the locked text", async () => {
		await saveClaude();
		const row = await readStoredRow();
		await stopApp();
		await startApp({ secret: "a-different-server-secret-after-rotation" });

		const view = await getSettings(ID.clientAdmin);
		expect(view.status).toBe(200);
		expect(view.json).toMatchObject({ configured: true, hasKey: true, keyUnreadable: true, keyEnding: null, provider: "anthropic" });
		expect(view.text).not.toContain(row?.key?.data ?? "missing");
		expect(await getStatus(ID.editor)).toMatchObject({ json: { enabled: false } });
		expect(await service.loadForUse({ siteId: ID.client })).toEqual({ ok: false, reason: "key_unreadable" });

		const keptWithoutKey = await putSettings(ID.clientAdmin, { provider: "anthropic", model: "claude-opus-5-5" });
		expect(keptWithoutKey).toMatchObject({ status: 400, json: { code: "key_needed", field: "apiKey", message: "The saved key can't be read any more. Enter it again." } });

		const replaced = await saveClaude(ID.clientAdmin, { apiKey: OTHER_KEY });
		expect(replaced.json).toMatchObject({ keyUnreadable: false, keyEnding: OTHER_KEY.slice(-4) });
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ ok: true, settings: { apiKey: OTHER_KEY } });
	});

	it("treats a damaged stored value as no settings instead of failing", async () => {
		await optionModel.setOption({ name: "ai_builder", value: "{not json", siteId: ID.client });
		expect((await getSettings(ID.clientAdmin)).json).toEqual({ configured: false });
		expect((await getStatus(ID.editor)).json).toEqual({ enabled: false, canManage: false });
		expect(logged.some((line) => line.includes("aiSettings.read"))).toBe(true);
	});
});

describe("who may do what", () => {
	it("needs a signed-in person and a site", async () => {
		expect((await getSettings(undefined)).status).toBe(401);
		expect((await getStatus(undefined)).status).toBe(401);
		expect((await putSettings(undefined, { provider: "anthropic", model: "m", apiKey: RAW_KEY })).status).toBe(401);
		expect((await removeSettings(undefined)).status).toBe(401);
		expect(await call({ path: "/api/ai-builder/settings", user: ID.clientAdmin })).toMatchObject({ status: 400, json: { message: "Pick a site first." } });
		expect(await call({ path: "/api/ai-builder/status?siteId=not-a-site", user: ID.clientAdmin })).toMatchObject({ status: 400 });
	});

	it("keeps settings to the site's owner and admins", async () => {
		await saveClaude(ID.clientAdmin);
		for (const user of [ID.editor, ID.outsider]) {
			expect((await getSettings(user)).status).toBe(403);
			expect((await putSettings(user, { provider: "anthropic", model: "m", apiKey: OTHER_KEY })).status).toBe(403);
			expect((await removeSettings(user)).status).toBe(403);
		}
		expect((await readStoredRow())?.model).toBe("claude-sonnet-5-5");
		expect(logged.some((line) => line.includes("aiBuilder.settings.save") && line.includes(ID.editor) && line.includes(ID.client))).toBe(true);
		expect((await getSettings(ID.clientOwner)).status).toBe(200);
		expect((await getSettings(ID.mainAdmin)).status).toBe(200);
	});

	it("does not let an admin of one site reach another site's settings", async () => {
		expect((await getSettings(ID.clientAdmin, ID.main)).status).toBe(403);
		expect((await putSettings(ID.clientAdmin, { siteId: ID.main, provider: "anthropic", model: "m", apiKey: RAW_KEY })).status).toBe(403);
		expect(await optionModel.getOption("ai_builder", ID.main)).toBeUndefined();
	});

	it("tells anyone who can edit the site whether the assistant is on, and whether they can turn it on", async () => {
		expect((await getStatus(ID.editor)).json).toEqual({ enabled: false, canManage: false });
		expect((await getStatus(ID.clientAdmin)).json).toEqual({ enabled: false, canManage: true });
		await saveClaude(ID.clientAdmin);
		expect((await getStatus(ID.editor)).json).toEqual({ enabled: true, canManage: false });
		expect((await getStatus(ID.clientOwner)).json).toEqual({ enabled: true, canManage: true });
		expect((await getStatus(ID.outsider)).status).toBe(403);
	});

	it("refuses an API key on every route, whatever scopes it has", async () => {
		const asKey = (token: string, method: "GET" | "PUT" | "DELETE", path: string) =>
			call({
				method,
				path,
				headers: { authorization: `Bearer ${token}` },
				body: method === "PUT" ? { siteId: ID.client, provider: "anthropic", model: "m", apiKey: RAW_KEY } : undefined,
			});

		for (const [method, path] of [
			["GET", `/api/ai-builder/status?siteId=${ID.client}`],
			["GET", settingsPath(ID.client)],
			["PUT", "/api/ai-builder/settings"],
			["DELETE", settingsPath(ID.client)],
		] as const) {
			expect(await asKey(API_KEY, method, path)).toMatchObject({ status: 403, json: { message: "Dashboard session required" } });
			expect(await asKey(KEY_WITHOUT_SETTINGS_SCOPE, method, path)).toMatchObject({ status: 403, json: { code: "API_KEY_SCOPE_DENIED" } });
		}
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
	});
});

describe("addresses for the generic OpenAI-compatible choice", () => {
	it("keeps local addresses to main-site admins", async () => {
		const refused = await saveCompatible(ID.clientAdmin, "http://localhost:11434/v1");
		expect(refused).toMatchObject({ status: 400, json: { code: "address_refused", field: "baseUrl" } });
		expect(refused.json.message).toBe("That address isn't reachable from the internet. Use a public https address, or ask the main site's admin to add a local one.");
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();

		const accepted = await saveCompatible(ID.mainAdmin, "http://localhost:11434/v1");
		expect(accepted).toMatchObject({ status: 200, json: { provider: "openai-compatible", baseUrl: "http://localhost:11434/v1" } });

		const ownerOfMain = await putSettings(ID.mainOwner, { siteId: ID.main, provider: "openai-compatible", model: "llama3.1:8b", baseUrl: "http://192.168.1.20:1234/v1", apiKey: RAW_KEY });
		expect(ownerOfMain.status).toBe(200);
	});

	it("refuses the cloud metadata address for everyone", async () => {
		for (const user of [ID.clientAdmin, ID.mainAdmin]) {
			const reply = await saveCompatible(user, "http://169.254.169.254/latest/meta-data");
			expect(reply).toMatchObject({ status: 400, json: { code: "address_refused", field: "baseUrl", message: "That address can't be used. Use the address your AI service gave you." } });
		}
		expect((await saveCompatible(ID.mainAdmin, "http://metadata.google.internal/computeMetadata/v1")).status).toBe(400);
	});

	it("counts a name that leads to a private address as private", async () => {
		dnsTable.set("llm.office.example.com", ["10.20.30.40"]);
		dnsTable.set("both.example.com", ["93.184.216.34", "fd00::9"]);
		expect((await saveCompatible(ID.clientAdmin, "https://llm.office.example.com/v1")).json.code).toBe("address_refused");
		expect((await saveCompatible(ID.clientAdmin, "https://both.example.com/v1")).json.code).toBe("address_refused");
		expect((await saveCompatible(ID.mainAdmin, "https://llm.office.example.com/v1")).status).toBe(200);
	});

	it("refuses a name that can't be found, and logs why", async () => {
		const reply = await saveCompatible(ID.mainAdmin, "https://no-such-host.example.com/v1");
		expect(reply).toMatchObject({ status: 400, json: { code: "address_refused", message: "We couldn't find that address. Check the spelling, then try again." } });
		expect(logged.some((line) => line.includes("ENOTFOUND no-such-host.example.com") && line.includes(ID.mainAdmin) && line.includes("aiSettings.save"))).toBe(true);
	});

	it("refuses plain http to a public host and accepts a public https one", async () => {
		dnsTable.set("api.example.com", ["93.184.216.34"]);
		const plain = await saveCompatible(ID.mainAdmin, "http://api.example.com/v1");
		expect(plain).toMatchObject({ status: 400, json: { code: "address_refused", message: "Use a secure address that starts with https:// for a service on the internet." } });
		const secure = await saveCompatible(ID.clientAdmin, "https://api.example.com/v1/");
		expect(secure).toMatchObject({ status: 200, json: { baseUrl: "https://api.example.com/v1" } });
	});

	it("needs an address for this choice and refuses one for the others", async () => {
		expect(await putSettings(ID.clientAdmin, { provider: "openai-compatible", model: "m", apiKey: RAW_KEY })).toMatchObject({
			status: 400,
			json: { code: "invalid_request", field: "baseUrl", message: "Enter the address of your AI service." },
		});
		expect(await saveClaude(ID.clientAdmin, { baseUrl: "https://api.anthropic.com" })).toMatchObject({
			status: 400,
			json: { code: "invalid_request", field: "baseUrl" },
		});
		expect((await saveClaude(ID.clientAdmin, { baseUrl: "" })).status).toBe(200);
	});
});

describe("saving", () => {
	it("refuses in production while the server still runs on the built-in sign-in secret", async () => {
		expect(isBuiltInAuthSecret(BUILT_IN_AUTH_SECRET)).toBe(true);
		expect(isBuiltInAuthSecret(SERVER_SECRET)).toBe(false);

		await stopApp();
		await startApp({ secret: BUILT_IN_AUTH_SECRET, isProduction: true });
		const refused = await saveClaude();
		expect(refused).toMatchObject({ status: 409, json: { code: "not_ready" } });
		expect(refused.text).not.toMatch(/secret|production|encrypt/i);
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
		expect(logged.some((line) => line.includes("built-in sign-in secret") && line.includes(ID.client))).toBe(true);

		await stopApp();
		await startApp({ secret: BUILT_IN_AUTH_SECRET, isProduction: false });
		expect((await saveClaude()).status).toBe(200);

		await stopApp();
		await startApp({ secret: SERVER_SECRET, isProduction: true });
		expect((await saveClaude(ID.clientAdmin, { apiKey: OTHER_KEY })).status).toBe(200);
	});

	it("needs a key the first time, and a new key when the provider or address changes", async () => {
		const first = await putSettings(ID.clientAdmin, { provider: "anthropic", model: "claude-sonnet-5-5" });
		expect(first).toMatchObject({ status: 400, json: { code: "key_needed", field: "apiKey" } });
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();

		await saveClaude();
		const changedProvider = await putSettings(ID.clientAdmin, { provider: "openai", model: "gpt-x" });
		expect(changedProvider).toMatchObject({ status: 400, json: { code: "key_needed", field: "apiKey", message: "You changed the provider or address, so enter a key for it." } });
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ ok: true, settings: { provider: "anthropic", apiKey: RAW_KEY } });

		dnsTable.set("api.example.com", ["93.184.216.34"]);
		dnsTable.set("other.example.com", ["93.184.216.35"]);
		await saveCompatible(ID.clientAdmin, "https://api.example.com/v1");
		const changedAddress = await putSettings(ID.clientAdmin, { provider: "openai-compatible", model: "m", baseUrl: "https://other.example.com/v1" });
		expect(changedAddress).toMatchObject({ status: 400, json: { code: "key_needed" } });
	});

	it("keeps the saved key when the key box is left empty and nothing else about the service changed", async () => {
		dnsTable.set("api.example.com", ["93.184.216.34"]);
		await saveCompatible(ID.clientAdmin, "https://api.example.com/v1");
		const rowBefore = await readStoredRow();

		const kept = await putSettings(ID.clientAdmin, { provider: "openai-compatible", model: "a-newer-model", baseUrl: "https://api.example.com/v1/", apiKey: "" });
		expect(kept).toMatchObject({ status: 200, json: { model: "a-newer-model", keyEnding: RAW_KEY.slice(-4) } });
		expect((await readStoredRow())?.key).toEqual(rowBefore?.key);
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ ok: true, settings: { model: "a-newer-model", apiKey: RAW_KEY } });
	});

	it("lets a local service be saved without a key, and writes that down openly", async () => {
		const address = "http://localhost:11434/v1";
		const saved = await saveCompatible(ID.mainAdmin, address, { apiKey: undefined });
		expect(saved).toMatchObject({
			status: 200,
			json: { provider: "openai-compatible", baseUrl: address, hasKey: false, keyEnding: null, keyUnreadable: false },
		});
		expect(await readStoredRow()).toMatchObject({ key: null, keyEnding: null });
		expect((await getSettings(ID.clientAdmin)).json).toMatchObject({ hasKey: false, keyUnreadable: false });
		expect((await getStatus(ID.editor)).json).toEqual({ enabled: true, canManage: false });
		expect(await service.loadForUse({ siteId: ID.client })).toEqual({
			ok: true,
			settings: { provider: "openai-compatible", model: "llama3.1:8b", baseUrl: address, apiKey: "", updatedBy: ID.mainAdmin },
		});

		// Changing the model keeps it keyless without asking for a key.
		const renamed = await putSettings(ID.mainAdmin, { provider: "openai-compatible", model: "qwen2.5", baseUrl: address });
		expect(renamed).toMatchObject({ status: 200, json: { model: "qwen2.5", hasKey: false } });

		// A changed sign-in secret has nothing to unlock, so a keyless service is not "unreadable".
		await stopApp();
		await startApp({ secret: "a-different-server-secret-after-rotation" });
		expect((await getSettings(ID.clientAdmin)).json).toMatchObject({ hasKey: false, keyUnreadable: false });
		expect((await getStatus(ID.editor)).json.enabled).toBe(true);

		// A key can be added later, and then a blank box keeps it.
		const withKey = await saveCompatible(ID.mainAdmin, address);
		expect(withKey.json).toMatchObject({ hasKey: true, keyEnding: RAW_KEY.slice(-4) });
		const kept = await putSettings(ID.mainAdmin, { provider: "openai-compatible", model: "qwen2.5", baseUrl: address });
		expect(kept.json).toMatchObject({ hasKey: true, keyEnding: RAW_KEY.slice(-4) });
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ settings: { apiKey: RAW_KEY } });
	});

	it("does not carry an old key over to a service it wasn't saved for", async () => {
		dnsTable.set("api.example.com", ["93.184.216.34"]);
		await saveCompatible(ID.mainAdmin, "https://api.example.com/v1");
		const moved = await putSettings(ID.mainAdmin, { provider: "openai-compatible", model: "llama3", baseUrl: "http://192.168.1.20:1234/v1" });
		expect(moved).toMatchObject({ status: 200, json: { hasKey: false } });
		expect(await readStoredRow()).toMatchObject({ key: null });
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ settings: { apiKey: "" } });
	});

	it("still needs a key for a public address and for the built-in providers", async () => {
		dnsTable.set("api.example.com", ["93.184.216.34"]);
		const publicNoKey = await saveCompatible(ID.mainAdmin, "https://api.example.com/v1", { apiKey: undefined });
		expect(publicNoKey).toMatchObject({ status: 400, json: { code: "key_needed", field: "apiKey", message: "Enter your key to save these settings." } });
		expect(await saveClaude(ID.mainAdmin, { apiKey: undefined })).toMatchObject({ status: 400, json: { code: "key_needed" } });
		expect(await putSettings(ID.mainAdmin, { provider: "openai", model: "gpt-x" })).toMatchObject({ status: 400, json: { code: "key_needed" } });
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
	});

	it("asks for a key again when a keyless service's name starts leading to the internet", async () => {
		dnsTable.set("llm.office.example.com", ["10.20.30.40"]);
		const keyless = await saveCompatible(ID.mainAdmin, "https://llm.office.example.com/v1", { apiKey: undefined });
		expect(keyless).toMatchObject({ status: 200, json: { hasKey: false } });

		dnsTable.set("llm.office.example.com", ["93.184.216.34"]);
		const again = await putSettings(ID.mainAdmin, { provider: "openai-compatible", model: "llama3.1:8b", baseUrl: "https://llm.office.example.com/v1" });
		expect(again).toMatchObject({ status: 400, json: { code: "key_needed", field: "apiKey" } });
	});

	it("keeps the keyless local path to main-site admins", async () => {
		const refused = await saveCompatible(ID.clientAdmin, "http://localhost:11434/v1", { apiKey: undefined });
		expect(refused).toMatchObject({ status: 400, json: { code: "address_refused" } });
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
	});

	it("locks a replaced key afresh", async () => {
		await saveClaude();
		const before = await readStoredRow();
		await saveClaude(ID.clientAdmin, { apiKey: OTHER_KEY });
		const after = await readStoredRow();
		expect(after?.key?.iv).not.toBe(before?.key?.iv);
		expect(after?.keyEnding).toBe(OTHER_KEY.slice(-4));
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ settings: { apiKey: OTHER_KEY } });
	});

	it("refuses details that are too long, missing or not usable, naming the field", async () => {
		expect(await saveClaude(ID.clientAdmin, { model: "m".repeat(201) })).toMatchObject({ status: 400, json: { code: "invalid_request", field: "model" } });
		expect(await saveClaude(ID.clientAdmin, { model: "   " })).toMatchObject({ status: 400, json: { field: "model" } });
		expect(await saveClaude(ID.clientAdmin, { apiKey: "has a space" })).toMatchObject({ status: 400, json: { field: "apiKey", message: "That key has characters that can't be used. Paste it again exactly as your provider gave it." } });
		expect(await saveClaude(ID.clientAdmin, { apiKey: "k".repeat(1025) })).toMatchObject({ status: 400, json: { field: "apiKey" } });
		expect(await saveClaude(ID.clientAdmin, { provider: "mystery" })).toMatchObject({ status: 400, json: { field: "provider" } });
		expect(await saveCompatible(ID.clientAdmin, `https://${"a".repeat(2050)}.example.com`)).toMatchObject({ status: 400, json: { field: "baseUrl" } });
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
	});

	it("allows ten saves per person in 15 minutes, counting every try", async () => {
		for (let attempt = 0; attempt < 10; attempt += 1) {
			expect((await saveClaude()).status).toBe(200);
		}
		const eleventh = await saveClaude();
		expect(eleventh).toMatchObject({ status: 429, json: { code: "rate_limited", message: "Too many saves. Wait a few minutes, then try again." } });
		expect(logged.some((line) => line.includes("too many tries") && line.includes(ID.clientAdmin))).toBe(true);
		expect((await saveClaude(ID.mainAdmin)).status).toBe(200);
	});

	it("removes the settings and the key, and removing again is harmless", async () => {
		await saveClaude();
		expect((await getStatus(ID.editor)).json.enabled).toBe(true);

		expect(await removeSettings(ID.clientAdmin)).toMatchObject({ status: 200, json: { removed: true } });
		expect(await optionModel.getOption("ai_builder", ID.client)).toBeUndefined();
		expect((await getSettings(ID.clientAdmin)).json).toEqual({ configured: false });
		expect((await getStatus(ID.editor)).json.enabled).toBe(false);
		expect(await service.loadForUse({ siteId: ID.client })).toEqual({ ok: false, reason: "not_configured" });
		expect(await removeSettings(ID.clientAdmin)).toMatchObject({ status: 200, json: { removed: false } });
	});

	it("keeps each site's settings apart", async () => {
		await saveClaude(ID.clientAdmin);
		await putSettings(ID.mainOwner, { siteId: ID.main, provider: "openai", model: "gpt-x", apiKey: OTHER_KEY });
		expect(await service.loadForUse({ siteId: ID.client })).toMatchObject({ settings: { provider: "anthropic", apiKey: RAW_KEY } });
		expect(await service.loadForUse({ siteId: ID.main })).toMatchObject({ settings: { provider: "openai", apiKey: OTHER_KEY } });
		await removeSettings(ID.mainOwner, ID.main);
		expect((await getStatus(ID.editor)).json.enabled).toBe(true);
	});
});

describe("the connection test seam", () => {
	it("says it isn't available until a tester is supplied, and asks for settings first", async () => {
		expect(await service.testConnection({ siteId: ID.client })).toMatchObject({ ok: false, code: "not_configured" });
		await saveClaude();
		expect(await service.testConnection({ siteId: ID.client })).toMatchObject({ ok: false, code: "not_available" });
	});

	it("hands the supplied tester the opened settings and returns its answer", async () => {
		const seen: string[] = [];
		await stopApp();
		await startApp({
			testConnection: async (settings) => {
				seen.push(`${settings.provider}:${settings.model}:${settings.apiKey}`);
				return { ok: false, code: "no_tool_use", message: "This model can't build pages." };
			},
		});
		await saveClaude();
		expect(await service.testConnection({ siteId: ID.client })).toEqual({ ok: false, code: "no_tool_use", message: "This model can't build pages." });
		expect(seen).toEqual([`anthropic:claude-sonnet-5-5:${RAW_KEY}`]);
	});

	it("turns a tester that throws into a plain failure and logs the cause", async () => {
		await stopApp();
		await startApp({
			testConnection: async () => {
				throw new Error("socket hang up");
			},
		});
		await saveClaude();
		const result = await service.testConnection({ siteId: ID.client });
		expect(result).toEqual({ ok: false, code: "failed", message: "The connection test couldn't run. Try again." });
		expect(logged.some((line) => line.includes("socket hang up") && line.includes(ID.client))).toBe(true);
		expect(logged.every((line) => !line.includes(RAW_KEY))).toBe(true);
	});
});

describe("the generic options routes leave reserved names alone", () => {
	it("answers the public read for a reserved name exactly like a missing option", async () => {
		await saveClaude();
		await optionModel.setOption({ name: "ai_builder_history", value: "secret-looking-value", siteId: ID.client });
		const missing = await call({ path: `/api/options/never-saved?siteId=${ID.client}` });
		expect(missing.status).toBe(404);

		for (const name of ["ai_builder", "AI_BUILDER", "ai_builder_history", "%20ai_builder"]) {
			const reply = await call({ path: `/api/options/${name}?siteId=${ID.client}` });
			expect(reply.status).toBe(missing.status);
			expect(reply.text).toBe(missing.text);
		}
	});

	it("refuses to write a reserved name, and leaves the saved settings as they were", async () => {
		await saveClaude();
		const before = (await optionModel.getOption("ai_builder", ID.client))?.value;

		for (const name of ["ai_builder", "Ai_Builder", "ai_builder_anything"]) {
			const reply = await call({ method: "POST", path: "/api/options", user: ID.clientAdmin, body: { siteId: ID.client, name, value: "overwritten" } });
			expect(reply).toMatchObject({ status: 400, json: { message: "That option name is reserved. Use a different name." } });
		}
		expect((await optionModel.getOption("ai_builder", ID.client))?.value).toBe(before);
		expect(await optionModel.getOption("ai_builder_anything", ID.client)).toBeUndefined();
	});

	it("still reads and writes ordinary options", async () => {
		const written = await call({ method: "POST", path: "/api/options", user: ID.clientAdmin, body: { siteId: ID.client, name: "homepage_page_slug", value: "home" } });
		expect(written.status).toBe(200);
		expect(await call({ path: `/api/options/homepage_page_slug?siteId=${ID.client}` })).toMatchObject({ status: 200, json: { value: "home" } });
	});
});

describe("data export", () => {
	it("leaves AI settings out, for every site and for one site, and keeps ordinary options", async () => {
		await saveClaude();
		await putSettings(ID.mainOwner, { siteId: ID.main, provider: "openai", model: "gpt-x", apiKey: OTHER_KEY });
		await optionModel.setOption({ name: "ai_builder_history", value: "more", siteId: ID.client });
		await optionModel.setOption({ name: "homepage_page_slug", value: "home", siteId: ID.client });
		await optionModel.setOption({ name: "homepage_page_slug", value: "start", siteId: ID.main });
		const sealed = (await readStoredRow())?.key?.data ?? "missing";

		const exporter = createTransferExporter({ models: buildTestModels(), appVersion: "1.0.0-test", log: () => {} });
		for (const siteSlug of [undefined, "Client", "Main"]) {
			const file = await exporter.exportData({ siteSlug });
			const names = (file.data.options ?? []).map((option) => option.name);
			expect(names.length).toBeGreaterThan(0);
			expect(names.every((name) => name === "homepage_page_slug")).toBe(true);
			expect(file.manifest.entityCounts.options).toBe(names.length);

			const text = JSON.stringify(file);
			expect(text).not.toContain(sealed);
			expect(text).not.toContain(RAW_KEY);
			expect(text).not.toContain("ai_builder");
		}
		expect(((await exporter.exportData({})).data.options ?? []).length).toBe(2);
	});
});
