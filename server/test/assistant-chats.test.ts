import express, { type Request, type RequestHandler } from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_CHAT_MESSAGES, type AssistantChatDocumentKind, type AssistantChatSummary } from "@shared/assistant-chats";
import { createAssistantChatBodyParser, createAssistantChatsRoutes } from "../routes/assistant-chats.routes";
import { createMemoryChatStore, createWorld, WORLD, type MemoryChatStore, type World } from "./fixtures/assistant-chat-world";

const SIGN_IN = "Sign in again to continue.";

const readHeaderUser = (req: Request): string | null => req.header("x-test-user") ?? null;
/** Like the real session check: nobody signed in, nothing else runs. */
const requireHeaderUser: RequestHandler = (req, res, next) => {
	if (readHeaderUser(req)) next();
	else res.status(401).json({ message: "Unauthorized" });
};
const passThrough: RequestHandler = (_req, _res, next) => next();

type Harness = { baseUrl: string; store: MemoryChatStore; world: World; server: Server };
type Reply = { status: number; body: { message?: string; code?: string; chats?: AssistantChatSummary[]; chat?: ChatBody; ok?: boolean } };
type ChatBody = AssistantChatSummary & { messages: Array<{ id: string }> };
type Message = { id: string; role: "user" | "assistant"; parts: Array<{ type: string; text?: string }> };

let harness: Harness | null = null;

const startApp = async ({
	requireSession = requireHeaderUser,
	getUserId = readHeaderUser,
}: { requireSession?: RequestHandler; getUserId?: (req: Request) => string | null } = {}): Promise<Harness> => {
	const store = createMemoryChatStore();
	const world = createWorld();
	let tick = 0;
	const app = express();
	// Same order as the real app: the chat's own reader first, the general one after.
	app.put("/api/assistant/chats/:chatId", createAssistantChatBodyParser({ requireSession, getUserId }));
	app.use(express.json());
	app.use(
		"/api/assistant/chats",
		createAssistantChatsRoutes({
			models: { ...world.models, assistantChats: store },
			requireSession,
			getUserId,
			now: () => new Date(Date.UTC(2026, 9, 24, 12, 0, tick++)),
		}),
	);
	const server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	harness = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, store, world, server };
	return harness;
};

const call = async ({
	user,
	method = "GET",
	path = "",
	body,
}: {
	user?: string;
	method?: string;
	path?: string;
	body?: object | string;
}): Promise<Reply> => {
	const response = await fetch(`${harness?.baseUrl}/api/assistant/chats${path}`, {
		method,
		headers: { ...(body ? { "content-type": "application/json" } : {}), ...(user ? { "x-test-user": user } : {}) },
		body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
	});
	return { status: response.status, body: await response.json() };
};

const chatId = (n: number): string => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const message = (index: number, value = `Message ${index}`): Message => ({
	id: `m${index}`,
	role: index % 2 === 0 ? "user" : "assistant",
	parts: [{ type: "text", text: value }],
});
const conversation = (count: number): Message[] => Array.from({ length: count }, (_, index) => message(index));

type Place = { siteId: string; documentKind: AssistantChatDocumentKind; documentId: string };
const PAGE_A: Place = { siteId: WORLD.siteA, documentKind: "page", documentId: WORLD.pageA };

const save = ({ user = WORLD.alice, id = chatId(1), place = PAGE_A, messages = conversation(2), extra = {} }: {
	user?: string;
	id?: string;
	place?: Place;
	messages?: Message[];
	extra?: object;
} = {}): Promise<Reply> => call({ user, method: "PUT", path: `/${id}`, body: { ...place, messages, ...extra } });

const list = ({ user = WORLD.alice, place = PAGE_A }: { user?: string; place?: Place } = {}): Promise<Reply> =>
  call({ user, path: `?${new URLSearchParams(place).toString()}` });

beforeEach(() => {
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await new Promise<void>((resolve) => (harness ? harness.server.close(() => resolve()) : resolve()));
	harness = null;
});

describe("saved assistant chats: who sees what", () => {
	it("lists only the signed-in person's chats for that page, newest first, without their messages", async () => {
		await startApp();
		await save({ id: chatId(1), messages: [message(0, "First ask")] });
		await save({ id: chatId(2), messages: [message(0, "Second ask")] });
		await save({ id: chatId(3), messages: [message(0, "Third ask")] });
		await save({ user: WORLD.bob, id: chatId(9), messages: [message(0, "Bob's ask")] });
		await save({ id: chatId(4), place: { ...PAGE_A, documentId: WORLD.pageA2 } });

		const mine = await list();
		expect(mine.status).toBe(200);
		expect(mine.body.chats?.map((chat) => chat.title)).toEqual(["Third ask", "Second ask", "First ask"]);
		expect(Object.keys(mine.body.chats?.[0] ?? {}).sort()).toEqual(["createdAt", "id", "title", "updatedAt"]);

		const bobs = await list({ user: WORLD.bob });
		expect(bobs.body.chats?.map((chat) => chat.title)).toEqual(["Bob's ask"]);
	});

	it("another person's chat is not found, whether they read it, save over it or delete it", async () => {
		const { store } = await startApp();
		await save({ id: chatId(1), messages: [message(0, "Alice's ask")] });

		const read = await call({ user: WORLD.bob, path: `/${chatId(1)}` });
		expect(read.status).toBe(404);
		expect(read.body).toEqual({ message: ASSISTANT_CHAT_MESSAGES.chatMissing, code: "chat_missing" });

		const overwrite = await save({ user: WORLD.bob, id: chatId(1), messages: [message(0, "Bob took over")] });
		expect(overwrite.status).toBe(404);

		const remove = await call({ user: WORLD.bob, method: "DELETE", path: `/${chatId(1)}` });
		expect(remove.status).toBe(404);

		expect(store.rows).toHaveLength(1);
		expect(store.rows[0]?.userId).toBe(WORLD.alice);
		expect(store.rows[0]?.messages[0]?.parts[0]).toMatchObject({ text: "Alice's ask" });
	});

	it("the owner comes from the sign-in, never from the request", async () => {
		const { store } = await startApp();
		const saved = await save({ extra: { userId: WORLD.bob } });
		expect(saved.status).toBe(200);
		expect(store.rows[0]?.userId).toBe(WORLD.alice);
	});

	it("a chat can't be moved to another page by saving it again with that page's address", async () => {
		const { store } = await startApp();
		await save({ id: chatId(1), messages: [message(0, "About page A")] });

		const moved = await save({ id: chatId(1), place: { ...PAGE_A, documentId: WORLD.pageA2 }, messages: [message(0, "Now page A2")] });
		expect(moved.status).toBe(404);
		expect(store.rows[0]?.documentId).toBe(WORLD.pageA);
		expect(store.rows[0]?.messages[0]?.parts[0]).toMatchObject({ text: "About page A" });
	});

	it("a post has its own chats, kept apart from pages", async () => {
		await startApp();
		const post: Place = { siteId: WORLD.siteA, documentKind: "post", documentId: WORLD.postA };
		expect((await save({ place: post, id: chatId(5) })).status).toBe(200);
		expect((await list({ place: post })).body.chats).toHaveLength(1);
		expect((await list()).body.chats).toHaveLength(0);
	});
});

describe("saved assistant chats: who may use them", () => {
	it("a page on another site is not found when the site named is yours, and the site is refused when it is not", async () => {
		await startApp();
		const otherSitePage: Place = { siteId: WORLD.siteA, documentKind: "page", documentId: WORLD.pageB };
		const asked = await list({ place: otherSitePage });
		expect(asked.status).toBe(404);
		expect(asked.body).toEqual({ message: "That page could not be found.", code: "page_missing" });
		expect((await save({ place: otherSitePage })).status).toBe(404);

		const otherSite: Place = { siteId: WORLD.siteB, documentKind: "page", documentId: WORLD.pageB };
		const refused = await list({ place: otherSite });
		expect(refused.status).toBe(403);
		expect(refused.body).toEqual({ message: "You don't have access to this site.", code: "not_allowed" });
		expect((await save({ place: otherSite })).status).toBe(403);
		expect((await list({ place: { ...PAGE_A, documentId: WORLD.missingPage } })).status).toBe(404);
	});

	it("people who can't use the assistant on the site get nothing: a subscriber and a stranger", async () => {
		const { store } = await startApp();
		for (const user of [WORLD.dave, WORLD.erin]) {
			expect((await list({ user })).status).toBe(403);
			expect((await save({ user })).status).toBe(403);
		}
		expect(store.rows).toHaveLength(0);
	});

	it("a person who loses access can no longer open, list or delete their own chats there", async () => {
		const { world } = await startApp();
		await save({ id: chatId(1) });
		world.assignments.splice(0, world.assignments.length);

		expect((await call({ path: `/${chatId(1)}`, user: WORLD.alice })).status).toBe(403);
		expect((await call({ method: "DELETE", path: `/${chatId(1)}`, user: WORLD.alice })).status).toBe(403);
		expect((await list()).status).toBe(403);
	});

	it("nobody signed in gets 401 on every call, and a big save is turned away before it is read", async () => {
		await startApp();
		const bigChat = [message(0, "x".repeat(300 * 1024))];
		expect((await call({})).status).toBe(401);
		expect((await call({ path: `/${chatId(1)}` })).status).toBe(401);
		expect((await call({ method: "DELETE", path: `/${chatId(1)}` })).status).toBe(401);
		expect((await call({ method: "PUT", path: `/${chatId(1)}`, body: { ...PAGE_A, messages: bigChat } })).status).toBe(401);
	});

	it("when the session check lets a request through without a person, the routes still answer 401 in plain words", async () => {
		await startApp({ requireSession: passThrough, getUserId: () => null });
		const reply = await call({ path: `/${chatId(1)}` });
		expect(reply.status).toBe(401);
		expect(reply.body.message).toBe(SIGN_IN);
	});
});

describe("saved assistant chats: the limits", () => {
	it("keeps 20 chats per person per page: the 21st drops the oldest, and other pages are left alone", async () => {
		const { store } = await startApp();
		await save({ id: chatId(100), place: { ...PAGE_A, documentId: WORLD.pageA2 } });
		for (let n = 1; n <= 21; n += 1) await save({ id: chatId(n), messages: [message(0, `Ask ${n}`)] });

		const mine = await list();
		expect(mine.body.chats).toHaveLength(20);
		expect(mine.body.chats?.[0]?.id).toBe(chatId(21));
		expect(mine.body.chats?.at(-1)?.id).toBe(chatId(2));
		expect((await call({ user: WORLD.alice, path: `/${chatId(1)}` })).status).toBe(404);
		expect(store.rows.filter((row) => row.documentId === WORLD.pageA)).toHaveLength(20);
		expect((await list({ place: { ...PAGE_A, documentId: WORLD.pageA2 } })).body.chats).toHaveLength(1);
	});

	it("saving a chat that already exists never drops another, even with 20 saved", async () => {
		await startApp();
		for (let n = 1; n <= 20; n += 1) await save({ id: chatId(n) });
		await save({ id: chatId(1), messages: conversation(4) });
		const mine = await list();
		expect(mine.body.chats).toHaveLength(20);
		expect(mine.body.chats?.[0]?.id).toBe(chatId(1));
	});

	it("keeps the newest 30 messages: the 31st pushes the oldest out", async () => {
		await startApp();
		await save({ messages: conversation(31) });
		const opened = await call({ user: WORLD.alice, path: `/${chatId(1)}` });
		expect(opened.body.chat?.messages).toHaveLength(30);
		expect(opened.body.chat?.messages[0]?.id).toBe("m1");
		expect(opened.body.chat?.messages.at(-1)?.id).toBe("m30");
	});

	it("saves a chat between the 100 KB the app reads elsewhere and the 256 KB cap", async () => {
		const { store } = await startApp();
		const saved = await save({ messages: [message(0, "x".repeat(200 * 1024))] });
		expect(saved.status).toBe(200);
		expect(store.rows).toHaveLength(1);
	});

	it("measures the chat after trimming: 35 long messages shrink to 30 and fit", async () => {
		const { store } = await startApp();
		const saved = await save({ messages: Array.from({ length: 35 }, (_, index) => message(index, "x".repeat(7680))) });
		expect(saved.status).toBe(200);
		expect(store.rows[0]?.messages).toHaveLength(30);
	});

	it("refuses a chat over 256 KB with the plain words, and saves nothing", async () => {
		const { store } = await startApp();
		const plain = { message: "This chat is too long to save. Start a new chat to keep going.", code: "too_long" };

		const justOver = await save({ messages: [message(0, "x".repeat(260 * 1024))] });
		expect(justOver.status).toBe(413);
		expect(justOver.body).toEqual(plain);

		const farOver = await save({ messages: [message(0, "x".repeat(300 * 1024))] });
		expect(farOver.status).toBe(413);
		expect(farOver.body).toEqual(plain);

		expect(store.rows).toHaveLength(0);
	});

	it("limits saves and deletes to 30 a minute per person, and only for the person who made them", async () => {
		await startApp();
		for (let n = 1; n <= 30; n += 1) expect((await save({ id: chatId(n) })).status).toBe(200);

		const refused = await save({ id: chatId(31) });
		expect(refused.status).toBe(429);
		expect(refused.body.message).toBe(ASSISTANT_CHAT_MESSAGES.tooManyChanges);
		expect((await call({ user: WORLD.alice, method: "DELETE", path: `/${chatId(1)}` })).status).toBe(429);

		expect((await list()).status).toBe(200);
		expect((await save({ user: WORLD.bob, id: chatId(90) })).status).toBe(200);
	});
});

describe("saved assistant chats: saving and deleting", () => {
	it("names a chat after its first request and keeps that name; saving it again changes the messages, not the date it began", async () => {
		await startApp();
		const first = await save({ messages: [message(0, "  Add a   pricing\nsection ")] });
		expect(first.body.chat?.title).toBe("Add a pricing section");

		const again = await save({ messages: [message(0, "Something else"), message(1, "Done"), message(2, "More")] });
		expect(again.status).toBe(200);
		expect(again.body.chat?.title).toBe("Add a pricing section");
		expect(again.body.chat?.createdAt).toBe(first.body.chat?.createdAt);
		expect(new Date(again.body.chat?.updatedAt ?? 0).getTime()).toBeGreaterThan(new Date(first.body.chat?.updatedAt ?? 0).getTime());

		const opened = await call({ user: WORLD.alice, path: `/${chatId(1)}` });
		expect(opened.body.chat?.messages.map((entry) => entry.id)).toEqual(["m0", "m1", "m2"]);
		expect((await list()).body.chats).toHaveLength(1);
	});

	it("deletes a chat, and a second delete says it is gone", async () => {
		const { store } = await startApp();
		await save();
		const removed = await call({ user: WORLD.alice, method: "DELETE", path: `/${chatId(1)}` });
		expect(removed.status).toBe(200);
		expect(removed.body).toEqual({ ok: true });
		expect(store.rows).toHaveLength(0);
		expect((await call({ user: WORLD.alice, method: "DELETE", path: `/${chatId(1)}` })).status).toBe(404);
	});

	it("turns away requests that are not shaped right, in plain words", async () => {
		await startApp();
		const invalid = { message: ASSISTANT_CHAT_MESSAGES.invalidRequest, code: "invalid_request" };

		const noMessages = await save({ messages: [] });
		expect(noMessages.status).toBe(400);
		expect(noMessages.body).toEqual(invalid);

		const badRole = await call({ user: WORLD.alice, method: "PUT", path: `/${chatId(1)}`, body: { ...PAGE_A, messages: [{ id: "m", role: "robot", parts: [{ type: "text" }] }] } });
		expect(badRole.status).toBe(400);

		const noPage = await call({ user: WORLD.alice, path: `?siteId=${WORLD.siteA}` });
		expect(noPage.status).toBe(400);
		expect(noPage.body).toEqual(invalid);

		const notAnId = await call({ user: WORLD.alice, path: "/not-an-id" });
		expect(notAnId.status).toBe(404);
		expect(notAnId.body.code).toBe("chat_missing");
	});
});

describe("saved assistant chats: when storage fails", () => {
	it("answers in plain words and logs who, which chat and why", async () => {
		const { store } = await startApp();
		store.listSummaries = async () => {
			throw new Error("database is down");
		};
		store.saveOwned = async () => {
			throw new Error("disk is full");
		};

		const listed = await list();
		expect(listed.status).toBe(500);
		expect(listed.body.message).toBe(ASSISTANT_CHAT_MESSAGES.loadFailed);
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				atFunction: "assistantChats.list",
				data: expect.objectContaining({ userId: WORLD.alice, documentId: WORLD.pageA, error: expect.any(Error) }),
			}),
		);

		const saved = await save();
		expect(saved.status).toBe(500);
		expect(saved.body.message).toBe(ASSISTANT_CHAT_MESSAGES.saveFailed);
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({
				atFunction: "assistantChats.save",
				data: expect.objectContaining({ userId: WORLD.alice, chatId: chatId(1), documentId: WORLD.pageA }),
			}),
		);
	});

	it("a save that went through stays a success when removing the oldest chats fails", async () => {
		const { store } = await startApp();
		store.removeOwnedMany = async () => {
			throw new Error("could not delete");
		};
		const saved = await save();
		expect(saved.status).toBe(200);
		expect(store.rows).toHaveLength(1);
		expect(console.error).toHaveBeenCalledWith(
			expect.objectContaining({ atFunction: "assistantChats.dropOldest", data: expect.objectContaining({ userId: WORLD.alice, chatId: chatId(1) }) }),
		);
	});
});
