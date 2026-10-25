import { describe, expect, it, vi } from "vitest";
import type { Deps } from "../routes/shared/deps";
import { forgetDocumentChats } from "../lib/assistant-chats";
import { createMemoryChatStore } from "./fixtures/assistant-chat-world";

const chat = ({ id, userId, documentKind, documentId }: { id: string; userId: string; documentKind: "page" | "post"; documentId: string }) => ({
	id,
	userId,
	siteId: "site-1",
	documentKind,
	documentId,
	title: "A chat",
	messages: [],
	now: new Date("2026-10-25T00:00:00Z"),
});

describe("forgetDocumentChats", () => {
	it("removes everyone's chats about the deleted page and nothing else", async () => {
		const store = createMemoryChatStore();
		await store.saveOwned(chat({ id: "c1", userId: "u1", documentKind: "page", documentId: "p1" }));
		await store.saveOwned(chat({ id: "c2", userId: "u2", documentKind: "page", documentId: "p1" }));
		await store.saveOwned(chat({ id: "c3", userId: "u1", documentKind: "page", documentId: "p2" }));
		await store.saveOwned(chat({ id: "c4", userId: "u1", documentKind: "post", documentId: "p1" }));

		await forgetDocumentChats({ models: { assistantChats: store } as unknown as Deps["models"], documentKind: "page", documentId: "p1" });

		expect(store.rows.map((row) => row.id).sort()).toEqual(["c3", "c4"]);
	});

	it("never fails the delete: a store error is logged with the ids and the cause", async () => {
		const failing = { removeForDocument: async () => Promise.reject(new Error("database is down")) };
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await expect(
			forgetDocumentChats({ models: { assistantChats: failing } as unknown as Deps["models"], documentKind: "post", documentId: "x9" }),
		).resolves.toBeUndefined();
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("not removed"),
			expect.objectContaining({ atFunction: "forgetDocumentChats", data: expect.objectContaining({ documentId: "x9", documentKind: "post" }) }),
		);
		log.mockRestore();
	});
});
