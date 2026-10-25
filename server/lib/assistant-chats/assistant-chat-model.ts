import type { assistantChats } from "@shared/schema";
import type { DatabaseInstance } from "@shared/create-models";
import type { AssistantChatDocumentKind, AssistantChatMessage } from "@shared/assistant-chats";
import {
	deleteDocumentChats,
	deleteOwnedChat,
	deleteOwnedChats,
	selectDocumentSummaries,
	selectOwnedChat,
	upsertOwnedChat,
} from "./assistant-chat-queries";
import type { AssistantChatRecord, AssistantChatStore, AssistantChatSummaryRecord } from "./types";

type AssistantChatRow = typeof assistantChats.$inferSelect;

/**
 * Rows hold the document kind as text and the messages as JSON; both were checked when the chat was saved,
 * so this only gives them their real types.
 */
const toRecord = (row: AssistantChatRow): AssistantChatRecord => ({
	...row,
	documentKind: row.documentKind as AssistantChatDocumentKind,
	messages: row.messages as AssistantChatMessage[],
});

/**
 * Saved assistant chats in the database. Deliberately not the generic model: that one can read or replace a
 * row by id alone, and a chat must never be reachable without saying whose it is.
 */
export function createAssistantChatModel(dbInstance: DatabaseInstance): AssistantChatStore {
	return {
		async findOwned({ id, userId }): Promise<AssistantChatRecord | undefined> {
			const rows: AssistantChatRow[] = await selectOwnedChat({ db: dbInstance, id, userId });
			return rows[0] ? toRecord(rows[0]) : undefined;
		},

		async listSummaries(params): Promise<AssistantChatSummaryRecord[]> {
			return selectDocumentSummaries({ db: dbInstance, ...params });
		},

		async saveOwned(chat): Promise<AssistantChatRecord | undefined> {
			const rows: AssistantChatRow[] = await upsertOwnedChat({ db: dbInstance, chat });
			return rows[0] ? toRecord(rows[0]) : undefined;
		},

		async removeOwned({ id, userId }): Promise<boolean> {
			const rows: Array<{ id: string }> = await deleteOwnedChat({ db: dbInstance, id, userId });
			return rows.length > 0;
		},

		async removeOwnedMany({ ids, userId }): Promise<void> {
			if (ids.length === 0) return;
			await deleteOwnedChats({ db: dbInstance, ids, userId });
		},

		async removeForDocument({ documentKind, documentId }): Promise<void> {
			await deleteDocumentChats({ db: dbInstance, documentKind, documentId });
		},
	};
}

export type AssistantChatModel = ReturnType<typeof createAssistantChatModel>;
