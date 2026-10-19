import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { AI_ASSISTANT_MESSAGES } from "@shared/ai-builder";
import { makeBlock } from "@shared/page-tools/test-support/memory-context";
import type { Deps } from "../routes/shared/deps";
import { countRemovedBlocks } from "../lib/ai-builder/assistant-tools";
import type { AiSettingsForUse } from "../lib/ai-builder";
import { createPinnedFetch } from "../lib/ai-builder/pinned-fetch";
import { createConnectionTester } from "../lib/ai-builder/test-connection";

const usage = { inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 2, text: 2, reasoning: 0 } };

const SETTINGS: AiSettingsForUse = { provider: "anthropic", model: "claude-sonnet-5-5", baseUrl: null, apiKey: "sk-test", updatedBy: "someone" };

/** No main site: only the built-in provider path (no address) runs here. */
const models = { sites: { findDefaultSite: async () => null } } as unknown as Pick<Deps["models"], "sites" | "roles" | "userRoles">;

const testerWith = (model: MockLanguageModelV4) =>
	createConnectionTester({ models, resolveDns: async () => [], createModel: () => model });

describe("the pinned connection", () => {
	let server: Server;
	let port: number;
	const seenHosts: string[] = [];

	beforeAll(async () => {
		server = createServer((req, res) => {
			seenHosts.push(req.headers.host ?? "");
			if (req.url === "/moved") {
				res.writeHead(302, { location: "http://169.254.169.254/" });
				res.end();
				return;
			}
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = (server.address() as AddressInfo).port;
	});

	afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

	it("connects only to the checked address, whatever the name resolves to now", async () => {
		const pinned = createPinnedFetch({ host: "ai.example.test", addresses: ["127.0.0.1"] });
		const reply = await pinned.fetch(`http://ai.example.test:${port}/v1/models`, { method: "GET" });
		expect(reply.status).toBe(200);
		expect(await reply.json()).toEqual({ ok: true });
		expect(seenHosts.at(-1)).toBe(`ai.example.test:${port}`);

		await expect(pinned.fetch(`http://elsewhere.example.test:${port}/`, { method: "GET" })).rejects.toThrow();
		await pinned.close();
	});

	it("never follows a redirect", async () => {
		const pinned = createPinnedFetch({ host: "ai.example.test", addresses: ["127.0.0.1"] });
		await expect(pinned.fetch(`http://ai.example.test:${port}/moved`, { method: "GET" })).rejects.toThrow();
		await pinned.close();
	});
});

describe("counting what a change removes", () => {
	const tree = [
		makeBlock({
			name: "core/container",
			id: "section",
			children: [makeBlock({ name: "core/paragraph", id: "a" }), makeBlock({ name: "core/paragraph", id: "b" })],
		}),
		makeBlock({ name: "core/paragraph", id: "loose" }),
	];

	it("counts a deleted or replaced block with everything inside it, and nothing else", () => {
		expect(countRemovedBlocks({ tree, input: { ops: [{ op: "delete", id: "section" }] } })).toBe(3);
		expect(countRemovedBlocks({ tree, input: { ops: [{ op: "replace", id: "loose", block: {} }, { op: "delete", id: "a" }] } })).toBe(2);
		expect(countRemovedBlocks({ tree, input: { ops: [{ op: "update", id: "section" }, { op: "delete", id: "missing" }] } })).toBe(0);
	});
});

describe("Test connection", () => {
	it("passes when the model calls the tool", async () => {
		const model = new MockLanguageModelV4({
			doGenerate: {
				content: [{ type: "tool-call", toolCallId: "c1", toolName: "say_ok", input: "{}" }],
				finishReason: { unified: "tool-calls", raw: "tool_use" },
				usage,
				warnings: [],
			},
		});
		expect(await testerWith(model)(SETTINGS)).toEqual({ ok: true });
	});

	it("finds a model that answers without using tools", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const model = new MockLanguageModelV4({
			doGenerate: { content: [{ type: "text", text: "ok" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
		});
		expect(await testerWith(model)(SETTINGS)).toEqual({ ok: false, code: "no_tool_use", message: AI_ASSISTANT_MESSAGES.noToolUse });
		vi.restoreAllMocks();
	});

	it("says the key was refused in plain words", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new APICallError({ message: "invalid x-api-key", url: "https://api.example.com", requestBodyValues: {}, statusCode: 401 });
			},
		});
		expect(await testerWith(model)(SETTINGS)).toEqual({ ok: false, code: "key_rejected", message: AI_ASSISTANT_MESSAGES.keyRefused });
		vi.restoreAllMocks();
	});
});
