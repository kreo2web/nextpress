import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
	deleteOwnedChat,
	deleteOwnedChats,
	selectDocumentSummaries,
	selectOwnedChat,
	upsertOwnedChat,
} from "../lib/assistant-chats/assistant-chat-queries";
import { createAssistantChatModel } from "../lib/assistant-chats/assistant-chat-model";

/*
 * No database here. `drizzle.mock()` builds the statements without connecting, and `.toSQL()` prints them,
 * so these tests read the SQL the model would send. What they prove: every statement is tied to the person
 * who owns the chat, and a save over an existing id can only touch that person's own chat for that page.
 */
const db = drizzle.mock();

const PERSON = "a0000000-0000-4000-8000-000000000001";
const CHAT = "c1000000-0000-4000-8000-000000000001";
const PAGE = "e0000000-0000-4000-8000-0000000000a1";
const SITE = "b0000000-0000-4000-8000-00000000000a";
const NOW = new Date(Date.UTC(2026, 9, 24, 12, 0, 0));

const OWNER_FILTER = /"assistant_chats"\."user_id" = \$\d+/;

describe("the saved-chat statements", () => {
	it("reading, listing and deleting always ask for the person's own chats", () => {
		const statements = [
			selectOwnedChat({ db, id: CHAT, userId: PERSON }).toSQL(),
			selectDocumentSummaries({ db, userId: PERSON, documentKind: "page", documentId: PAGE, limit: 20 }).toSQL(),
			deleteOwnedChat({ db, id: CHAT, userId: PERSON }).toSQL(),
			deleteOwnedChats({ db, ids: [CHAT], userId: PERSON }).toSQL(),
		];

		statements.forEach((statement) => {
			expect(statement.sql).toMatch(OWNER_FILTER);
			expect(statement.params).toContain(PERSON);
		});
	});

	it("the list reads only the columns it shows, newest first, up to the limit", () => {
		const { sql, params } = selectDocumentSummaries({ db, userId: PERSON, documentKind: "page", documentId: PAGE, limit: 20 }).toSQL();

		expect(sql).not.toContain('"messages"');
		expect(sql).toMatch(/order by "assistant_chats"\."updated_at" desc limit \$\d+/);
		expect(params).toEqual([PERSON, "page", PAGE, 20]);
	});

	it("a save over an existing id only changes the messages and time, and only for the same person and page", () => {
		const { sql, params } = upsertOwnedChat({
			db,
			chat: {
				id: CHAT,
				userId: PERSON,
				siteId: SITE,
				documentKind: "page",
				documentId: PAGE,
				title: "Add a hero",
				messages: [{ id: "m0", role: "user", parts: [{ type: "text", text: "Add a hero" }] }],
				now: NOW,
			},
		}).toSQL();

		expect(sql).toMatch(/on conflict \("id"\) do update set "messages" = \$\d+, "updated_at" = \$\d+ where /);
		const guard = sql.slice(sql.indexOf(" where "));
		['"user_id"', '"site_id"', '"document_kind"', '"document_id"'].forEach((column) => {
			expect(guard).toMatch(new RegExp(`"assistant_chats"\\.${column} = \\$\\d+`));
		});
		expect(params.filter((value: unknown) => value === PERSON)).toHaveLength(2);
		expect(sql).toContain("returning");
	});
});

describe("the saved-chat model", () => {
	it("deleting no chats does not touch the database", async () => {
		const untouchable = new Proxy({}, { get: () => { throw new Error("the database was used"); } });
		await expect(createAssistantChatModel(untouchable).removeOwnedMany({ ids: [], userId: PERSON })).resolves.toBeUndefined();
	});
});
