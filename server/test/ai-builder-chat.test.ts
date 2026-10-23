import express from "express";
import { inspect } from "node:util";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, type LanguageModel } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { AI_ASSISTANT_MESSAGES } from "@shared/ai-builder";
import { createModel } from "@shared/create-models";
import { blogs, options as optionsTable } from "@shared/schema";
import { makeBlock } from "@shared/page-tools/test-support/memory-context";
import { testDb } from "./setup";
import {
	createMediaModel,
	createOptionModel,
	createPageModel,
	createPostModel,
	createRoleModel,
	createSiteModel,
	createTemplateModel,
	createThemeModel,
	createUserModel,
	createUserRoleModel,
} from "../storage";
import { authService, requireSessionAuth } from "../auth";
import { apiKeyScopeEnforcer } from "../middleware/api-key-scope-enforcer";
import { createAiAssistantRoutes } from "../routes/ai-builder-chat.routes";
import type { Deps } from "../routes/shared/deps";
import { createAiSettingsService, type AiSettingsService, type ResolveDns } from "../lib/ai-builder";
import { createRunRegistry } from "../lib/ai-builder/run-registry";

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
	verifyApiKey: async () => ({ id: "key-1", userId: "7c2a0000-0000-4000-8000-000000000002", siteId: "7c2a0000-0000-4000-8000-000000000012", scopes: ["settings:read", "settings:write"] }),
}));

const ID = {
	mainOwner: "7c2a0000-0000-4000-8000-000000000001",
	clientOwner: "7c2a0000-0000-4000-8000-000000000002",
	mainAdmin: "7c2a0000-0000-4000-8000-000000000003",
	editor: "7c2a0000-0000-4000-8000-000000000005",
	outsider: "7c2a0000-0000-4000-8000-000000000006",
	main: "7c2a0000-0000-4000-8000-000000000011",
	client: "7c2a0000-0000-4000-8000-000000000012",
	adminRole: "7c2a0000-0000-4000-8000-000000000021",
	editorRole: "7c2a0000-0000-4000-8000-000000000022",
	clientPage: "7c2a0000-0000-4000-8000-000000000031",
	mainPage: "7c2a0000-0000-4000-8000-000000000032",
};

const RAW_KEY = "sk-live-chat-test-5b4a39281706f5e4d3c2b1a0";
const SERVER_SECRET = "a-long-random-server-secret-for-the-chat-test";

const sites = createSiteModel(testDb);
const roles = createRoleModel(testDb);
const userRoles = createUserRoleModel(testDb);
const users = createUserModel(testDb);
const pages = createPageModel(testDb);
const options = createOptionModel(testDb);
const models = {
	sites,
	roles,
	userRoles,
	users,
	pages,
	options,
	posts: createPostModel(testDb),
	blogs: createModel(blogs, testDb),
	media: createMediaModel(testDb),
	templates: createTemplateModel(testDb),
	themes: createThemeModel(testDb),
} as unknown as Deps["models"];

const resolveDns: ResolveDns = async (hostname) => {
	throw new Error(`getaddrinfo ENOTFOUND ${hostname}`);
};

const SECTION = makeBlock({ name: "core/container", id: "section-1" });
const BIG_SECTION = makeBlock({
	name: "core/container",
	id: "big-1",
	children: Array.from({ length: 11 }, (_, index) => makeBlock({ name: "core/paragraph", id: `big-text-${index}` })),
});

const logged: string[] = [];
let server: Server;
let baseUrl: string;
let service: AiSettingsService;
let currentModel: LanguageModel;

const usage = { inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 30, text: 30, reasoning: 0 } };

type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

const step = (parts: StreamPart[], finish: "tool-calls" | "stop"): StreamResult => ({
	stream: convertArrayToReadableStream<StreamPart>([
		{ type: "stream-start", warnings: [] },
		...parts,
		{ type: "finish", usage, finishReason: { unified: finish, raw: finish } },
	]),
});

const toolCall = (toolName: string, input: Record<string, unknown>, id = "call-1") =>
	({ type: "tool-call", toolCallId: id, toolName, input: JSON.stringify(input) }) as StreamPart;

const text = (value: string): StreamPart[] => [
	{ type: "text-start", id: "t1" },
	{ type: "text-delta", id: "t1", delta: value },
	{ type: "text-end", id: "t1" },
];

/** A model that waits until the run is stopped. */
const hangingModel = () =>
	new MockLanguageModelV4({
		doStream: async ({ abortSignal }) => ({
			stream: new ReadableStream({
				start(controller) {
					controller.enqueue({ type: "stream-start", warnings: [] });
					abortSignal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
				},
			}),
		}),
	});

const startApp = async ({ maxPerHour }: { maxPerHour?: number } = {}): Promise<void> => {
	service = createAiSettingsService({ models, getSecret: () => SERVER_SECRET, isProduction: false, resolveDns, now: () => new Date() });
	const app = express();
	app.use(express.json({ limit: "4mb" }));
	app.use(apiKeyScopeEnforcer);
	app.use(
		"/api/ai-builder",
		createAiAssistantRoutes({
			models,
			requireSession: requireSessionAuth,
			getUserId: (req) => authService.getCurrentUserId(req),
			service,
			resolveDns,
			registry: createRunRegistry({ maxPerHour }),
			createModel: () => currentModel,
		}),
	);
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

type ChatBody = { siteId?: string; pageId?: string; focusBlockId?: string; blocks?: object[] };

const chatBody = ({ siteId = ID.client, pageId = ID.clientPage, focusBlockId, blocks = [SECTION] }: ChatBody = {}) => ({
	siteId,
	pageId,
	contentType: "page",
	blocks,
	...(focusBlockId ? { focusBlockId } : {}),
	messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Add a pricing heading" }] }],
});

const postChat = (user: string | undefined, body: object = chatBody(), init: RequestInit = {}) =>
	fetch(`${baseUrl}/api/ai-builder/chat`, {
		method: "POST",
		headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
		body: JSON.stringify(body),
		...init,
	});

type Chunk = { type: string; data?: { summary: { inserted: string[] }; blocks: Array<{ id: string; children?: object[] }> }; transient?: boolean; output?: string; errorText?: string; delta?: string };

const readChunks = async (res: Response): Promise<Chunk[]> =>
	(await res.text())
		.split("\n")
		.filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
		.map((line) => JSON.parse(line.slice(6)) as Chunk);

const saveClaude = () =>
	service.save({ siteId: ID.client, userId: ID.clientOwner, values: { provider: "anthropic", model: "claude-sonnet-5-5", apiKey: RAW_KEY }, canUsePrivateAddress: false });

beforeAll(async () => {
	for (const [id, username] of [
		[ID.mainOwner, "chat-main-owner"],
		[ID.clientOwner, "chat-client-owner"],
		[ID.mainAdmin, "chat-main-admin"],
		[ID.editor, "chat-editor"],
		[ID.outsider, "chat-outsider"],
	]) {
		await users.create({ id, username, email: `${username}@example.com` });
	}
	await roles.create({ id: ID.adminRole, name: "admin" });
	await roles.create({ id: ID.editorRole, name: "editor" });
	await sites.create({ id: ID.main, name: "Main", ownerId: ID.mainOwner, isDefault: true, siteUrl: "https://example.com" });
	await sites.create({ id: ID.client, name: "Client", ownerId: ID.clientOwner, siteUrl: "https://client.example.com" });
	await userRoles.assignRole(ID.mainAdmin, ID.adminRole, ID.main);
	await userRoles.assignRole(ID.mainAdmin, ID.adminRole, ID.client);
	await userRoles.assignRole(ID.editor, ID.editorRole, ID.client);
	await pages.create({ id: ID.clientPage, title: "Home", slug: "home", siteId: ID.client, authorId: ID.clientOwner });
	await pages.create({ id: ID.mainPage, title: "Main home", slug: "main-home", siteId: ID.main, authorId: ID.mainOwner });
});

beforeEach(async () => {
	await testDb.delete(optionsTable);
	logged.length = 0;
	for (const method of ["log", "info", "warn", "error", "debug"] as const) {
		vi.spyOn(console, method).mockImplementation((...args) => {
			logged.push(inspect(args, { depth: 8 }));
		});
	}
	await startApp();
	await saveClaude();
});

afterEach(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
	vi.restoreAllMocks();
});

describe("a composed run", () => {
	it("adds a section on the working copy, streams the change and the reply, and logs tokens without the key", async () => {
		currentModel = new MockLanguageModelV4({
			doStream: [
				step([toolCall("change_blocks", { ops: [{ op: "insert", parentId: "section-1", block: { name: "core/heading", content: { value: "Pricing" } } }] })], "tool-calls"),
				step(text("I added a Pricing heading."), "stop"),
			],
		});

		const res = await postChat(ID.editor);
		expect(res.status).toBe(200);
		const chunks = await readChunks(res);

		const change = chunks.find((chunk) => chunk.type === "data-page-change");
		expect(change?.transient).toBe(true);
		expect(change?.data?.summary.inserted).toHaveLength(1);
		expect(change?.data?.blocks[0]?.children).toHaveLength(1);
		expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe("I added a Pricing heading.");

		await vi.waitFor(() => expect(logged.join("\n")).toContain("Assistant run finished"));
		const finish = logged.find((line) => line.includes("Assistant run finished")) ?? "";
		expect(finish).toContain(ID.editor);
		expect(finish).toContain(ID.clientPage);
		expect(finish).toContain("inputTokens: 240");
		expect(JSON.stringify(chunks)).not.toContain(RAW_KEY);
		expect(logged.join("\n")).not.toContain(RAW_KEY);
		expect(logged.join("\n")).not.toContain("Add a pricing heading");
	});

	it("refuses a change outside the selected block and streams no page change", async () => {
		const other = makeBlock({ name: "core/container", id: "section-2" });
		currentModel = new MockLanguageModelV4({
			doStream: [step([toolCall("change_blocks", { ops: [{ op: "delete", id: "section-2" }] })], "tool-calls"), step(text("Done."), "stop")],
		});

		const chunks = await readChunks(await postChat(ID.editor, chatBody({ focusBlockId: "section-1", blocks: [SECTION, other] })));
		expect(chunks.some((chunk) => chunk.type === "data-page-change")).toBe(false);
		const output = chunks.find((chunk) => chunk.type === "tool-output-available")?.output ?? "";
		expect(output.length).toBeGreaterThan(0);
		expect(output).toContain("section-1");
	});

	it("waits for the person before removing more than ten blocks", async () => {
		currentModel = new MockLanguageModelV4({ doStream: [step([toolCall("change_blocks", { ops: [{ op: "delete", id: "big-1" }] })], "tool-calls")] });

		const chunks = await readChunks(await postChat(ID.editor, chatBody({ blocks: [BIG_SECTION] })));
		expect(chunks.some((chunk) => chunk.type === "tool-approval-request")).toBe(true);
		expect(chunks.some((chunk) => chunk.type === "data-page-change")).toBe(false);
	});

	it("after the person says no to a removal, refuses any other removal in that request without asking again", async () => {
		// The editor sends the answer back as the last assistant turn; the model then tries a smaller removal.
		const declined = {
			id: "a1",
			role: "assistant",
			parts: [
				{ type: "step-start" },
				{
					type: "tool-change_blocks",
					toolCallId: "call-0",
					state: "approval-responded",
					input: { ops: [{ op: "delete", id: "big-1" }] },
					approval: { id: "approval-0", approved: false },
				},
			],
		};
		const smallerRemoval = () =>
			new MockLanguageModelV4({
				doStream: [
					step([toolCall("change_blocks", { ops: [{ op: "delete", id: "big-text-0" }] }, "call-1")], "tool-calls"),
					step(text("Done."), "stop"),
				],
			});
		const body = chatBody({ blocks: [BIG_SECTION] });

		currentModel = smallerRemoval();
		const chunks = await readChunks(await postChat(ID.editor, { ...body, messages: [...body.messages, declined] }));
		expect(chunks.some((chunk) => chunk.type === "data-page-change")).toBe(false);
		expect(chunks.some((chunk) => chunk.type === "tool-approval-request")).toBe(false);
		expect(chunks.find((chunk) => chunk.type === "tool-output-available")?.output).toContain("said no to removing blocks");

		currentModel = smallerRemoval();
		const fresh = await readChunks(await postChat(ID.editor, body));
		expect(fresh.find((chunk) => chunk.type === "data-page-change")?.data?.blocks[0]?.children).toHaveLength(10);
	});

	it("applies a change sent as text with one closing brace too many, in one step", async () => {
		// Seen on a real gateway, every time a smaller model wrote `ops` as a string.
		const sent = '[{"op": "update", "id": "section-1", "styles": {"backgroundColor": "red"}}}]';
		const model = new MockLanguageModelV4({
			doStream: [
				step([{ type: "tool-call", toolCallId: "call-1", toolName: "change_blocks", input: JSON.stringify({ ops: sent }) }], "tool-calls"),
				step(text("Done."), "stop"),
			],
		});
		currentModel = model;

		const chunks = await readChunks(await postChat(ID.editor));
		expect(chunks.some((chunk) => chunk.type === "tool-input-error")).toBe(false);
		expect(chunks.find((chunk) => chunk.type === "data-page-change")?.data?.blocks[0]).toMatchObject({ styles: { backgroundColor: "red" } });
		expect(model.doStreamCalls).toHaveLength(2);
	});

	it("lets the model retry a change it sent unreadable, and ends the run once, as finished", async () => {
		// `ops` as a string with a missing comma: no repair can guess that.
		const unreadable = '[{"op": "update" "id": "section-1", "styles": {"backgroundColor": "red"}}]';
		const model = new MockLanguageModelV4({
			doStream: [
				step([{ type: "tool-call", toolCallId: "call-1", toolName: "change_blocks", input: JSON.stringify({ ops: unreadable }) }], "tool-calls"),
				step([toolCall("change_blocks", { ops: [{ op: "update", id: "section-1", styles: { backgroundColor: "red" } }] }, "call-2")], "tool-calls"),
				step(text("Done."), "stop"),
			],
		});
		currentModel = model;

		const chunks = await readChunks(await postChat(ID.editor));
		expect(chunks.find((chunk) => chunk.type === "tool-input-error")?.errorText).toBe(AI_ASSISTANT_MESSAGES.malformedToolInput);
		expect(chunks.find((chunk) => chunk.type === "tool-output-error")?.errorText).toBe(AI_ASSISTANT_MESSAGES.malformedToolInput);
		expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
		expect(chunks.some((chunk) => chunk.type === "data-page-change")).toBe(true);
		expect(model.doStreamCalls).toHaveLength(3);

		await vi.waitFor(() => expect(logged.join("\n")).toContain("Assistant run finished"));
		expect(logged.join("\n")).not.toContain("Assistant run failed");
		expect(logged.join("\n")).toContain("could not be repaired");
	});

	it("stops after the step cap", async () => {
		const model = new MockLanguageModelV4({
			doStream: async () => step([toolCall("get_page_outline", {}, crypto.randomUUID())], "tool-calls"),
		});
		currentModel = model;

		await readChunks(await postChat(ID.editor));
		expect(model.doStreamCalls).toHaveLength(25);
	});
});

describe("limits and Stop", () => {
	it("allows one run per person at a time, and Stop frees it and stops the model", async () => {
		currentModel = hangingModel();
		const stop = new AbortController();
		const first = await postChat(ID.editor, chatBody(), { signal: stop.signal });
		expect(first.status).toBe(200);

		const second = await postChat(ID.editor);
		expect(second.status).toBe(409);
		expect((await second.json()).message).toBe(AI_ASSISTANT_MESSAGES.alreadyRunning);

		stop.abort();
		await vi.waitFor(() => expect(logged.join("\n")).toContain("Assistant run stopped"));

		currentModel = new MockLanguageModelV4({ doStream: [step(text("Hi."), "stop")] });
		expect((await postChat(ID.editor)).status).toBe(200);
	});

	it("caps runs per hour", async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await startApp({ maxPerHour: 1 });
		currentModel = new MockLanguageModelV4({ doStream: [step(text("One."), "stop"), step(text("Two."), "stop")] });

		await readChunks(await postChat(ID.editor));
		const refused = await postChat(ID.editor);
		expect(refused.status).toBe(429);
		expect((await refused.json()).message).toBe(AI_ASSISTANT_MESSAGES.hourlyLimit);
	});
});

describe("who may start it and what they hear when it fails", () => {
	it("refuses people who can't edit the page, pages on other sites, sites without settings, and API keys", async () => {
		currentModel = new MockLanguageModelV4({ doStream: [step(text("Hi."), "stop")] });
		expect((await postChat(ID.outsider)).status).toBe(403);
		expect((await postChat(undefined)).status).toBe(401);
		expect((await postChat(ID.editor, chatBody({ pageId: ID.mainPage }))).status).toBe(404);
		expect((await postChat(ID.editor, { ...chatBody(), blocks: "nope" })).status).toBe(400);

		await testDb.delete(optionsTable);
		const unconfigured = await postChat(ID.editor);
		expect(unconfigured.status).toBe(409);
		expect((await unconfigured.json()).message).toBe(AI_ASSISTANT_MESSAGES.notConfigured);

		const withKey = await fetch(`${baseUrl}/api/ai-builder/chat`, {
			method: "POST",
			headers: { "content-type": "application/json", authorization: "Bearer npk_live_anything" },
			body: JSON.stringify(chatBody()),
		});
		expect(withKey.status).toBeGreaterThanOrEqual(401);
		expect(withKey.status).toBeLessThan(404);
	});

	it("turns a refused key into a plain next step and keeps the cause in the log", async () => {
		currentModel = new MockLanguageModelV4({
			doStream: async () => {
				throw new APICallError({ message: "invalid x-api-key", url: "https://api.example.com", requestBodyValues: {}, statusCode: 401 });
			},
		});

		const chunks = await readChunks(await postChat(ID.editor));
		expect(chunks.find((chunk) => chunk.type === "error")?.errorText).toBe(AI_ASSISTANT_MESSAGES.keyRefused);
		await vi.waitFor(() => expect(logged.join("\n")).toContain("invalid x-api-key"));
	});

	it("refuses a saved local address once the person who saved it is no longer a main-site admin", async () => {
		const saved = await service.save({
			siteId: ID.client,
			userId: ID.mainAdmin,
			values: { provider: "openai-compatible", model: "llama3.1:8b", baseUrl: "http://localhost:11434/v1" },
			canUsePrivateAddress: true,
		});
		expect(saved.ok).toBe(true);
		currentModel = new MockLanguageModelV4({ doStream: [step(text("Hi."), "stop")] });
		expect((await postChat(ID.editor)).status).toBe(200);

		await userRoles.removeRole(ID.mainAdmin, ID.adminRole, ID.main);
		const refused = await postChat(ID.editor);
		await userRoles.assignRole(ID.mainAdmin, ID.adminRole, ID.main);
		expect(refused.status).toBe(400);
		expect((await refused.json()).code).toBe("address_refused");
	});
});
