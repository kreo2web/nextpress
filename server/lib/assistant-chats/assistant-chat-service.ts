import {
	ASSISTANT_CHAT_LIMITS,
	ASSISTANT_CHAT_MESSAGES,
	deriveChatTitle,
	keepNewestMessages,
	type AssistantChatDocument,
	type AssistantChatErrorCode,
	type AssistantChatMessage,
	type AssistantChatSummary,
	type AssistantChatWithMessages,
} from "@shared/assistant-chats";
import { safeTryAsync } from "../../utils";
import type { PageEditCheck } from "../ai-builder/assert-page-edit";
import type { AssistantChatRecord, AssistantChatStore, AssistantChatSummaryRecord } from "./types";

/** An answer the route sends as it is: the status, a code for the editor, and plain words for the person. */
export type ChatRefusal = { ok: false; status: number; code: AssistantChatErrorCode; message: string };

export type CheckDocumentAccess = (params: { userId: string } & AssistantChatDocument) => Promise<PageEditCheck>;

export type AssistantChatService = {
	list: (params: { userId: string; document: AssistantChatDocument }) => Promise<{ ok: true; chats: AssistantChatSummary[] } | ChatRefusal>;
	read: (params: { userId: string; chatId: string }) => Promise<{ ok: true; chat: AssistantChatWithMessages } | ChatRefusal>;
	save: (params: {
		userId: string;
		chatId: string;
		document: AssistantChatDocument;
		messages: AssistantChatMessage[];
	}) => Promise<{ ok: true; chat: AssistantChatSummary } | ChatRefusal>;
	remove: (params: { userId: string; chatId: string }) => Promise<{ ok: true } | ChatRefusal>;
};

const CHAT_MISSING: ChatRefusal = { ok: false, status: 404, code: "chat_missing", message: ASSISTANT_CHAT_MESSAGES.chatMissing };
const TOO_LONG: ChatRefusal = { ok: false, status: 413, code: "too_long", message: ASSISTANT_CHAT_MESSAGES.tooLong };

/** How many chats past the limit one trim looks at. Normally there is one; this only bounds a pile-up. */
const TRIM_LOOKAHEAD = 100;

const toSummary = (record: AssistantChatSummaryRecord): AssistantChatSummary => ({
	id: record.id,
	title: record.title,
	createdAt: record.createdAt.toISOString(),
	updatedAt: record.updatedAt.toISOString(),
});

const toChat = (record: AssistantChatRecord): AssistantChatWithMessages => ({ ...toSummary(record), messages: record.messages });

const refuseAccess = (check: Extract<PageEditCheck, { ok: false }>): ChatRefusal => ({
	ok: false,
	status: check.status,
	code: check.code,
	message: check.message,
});

const sizeInBytes = (messages: AssistantChatMessage[]): number => Buffer.byteLength(JSON.stringify(messages), "utf8");

/**
 * The rules for saved assistant chats, apart from HTTP and from the database. Every call names the person,
 * and every call re-checks that they may still use the assistant on the page or post the chat belongs to.
 * `now` is injected so tests can make saves land in a known order.
 */
export function createAssistantChatService({
	store,
	checkAccess,
	now = () => new Date(),
}: {
	store: AssistantChatStore;
	checkAccess: CheckDocumentAccess;
	now?: () => Date;
}): AssistantChatService {
	/**
	 * Keeps the newest chats of one person for one page. Runs after the save, never before: a failed save must
	 * not cost the person an old chat. A failure here is logged and left for the next save to fix.
	 */
	const dropOldest = async ({ userId, chatId, document }: { userId: string; chatId: string; document: AssistantChatDocument }): Promise<void> => {
		const { chatsPerDocument } = ASSISTANT_CHAT_LIMITS;
		const { err } = await safeTryAsync(async () => {
			const chats = await store.listSummaries({
				userId,
				documentKind: document.documentKind,
				documentId: document.documentId,
				limit: chatsPerDocument + TRIM_LOOKAHEAD,
			});
			const extraIds = chats
				.slice(chatsPerDocument)
				.map((chat) => chat.id)
				.filter((id) => id !== chatId);
			await store.removeOwnedMany({ ids: extraIds, userId });
		});
		if (err) {
			console.error({
				atFunction: "assistantChats.dropOldest",
				data: { userId, chatId, documentId: document.documentId, documentKind: document.documentKind, error: err },
				message: "Could not remove the oldest chats after a save; the next save will try again",
			});
		}
	};

	return {
		async list({ userId, document }) {
			const access = await checkAccess({ userId, ...document });
			if (!access.ok) return refuseAccess(access);

			const chats = await store.listSummaries({
				userId,
				documentKind: document.documentKind,
				documentId: document.documentId,
				limit: ASSISTANT_CHAT_LIMITS.chatsPerDocument,
			});
			return { ok: true, chats: chats.map(toSummary) };
		},

		async read({ userId, chatId }) {
			const record = await store.findOwned({ id: chatId, userId });
			if (!record) return CHAT_MISSING;

			const access = await checkAccess({
				userId,
				siteId: record.siteId,
				documentKind: record.documentKind,
				documentId: record.documentId,
			});
			if (!access.ok) return refuseAccess(access);
			return { ok: true, chat: toChat(record) };
		},

		async save({ userId, chatId, document, messages }) {
			const access = await checkAccess({ userId, ...document });
			if (!access.ok) return refuseAccess(access);

			// Trim first, then measure: the cap is on what gets stored.
			const kept = keepNewestMessages(messages);
			if (sizeInBytes(kept) > ASSISTANT_CHAT_LIMITS.bytesPerChat) return TOO_LONG;

			const saved = await store.saveOwned({
				id: chatId,
				userId,
				...document,
				title: deriveChatTitle(kept),
				messages: kept,
				now: now(),
			});
			// Not saved means the id is taken by someone else's chat or by another page's: say "not found", never which.
			if (!saved) return CHAT_MISSING;

			await dropOldest({ userId, chatId, document });
			return { ok: true, chat: toSummary(saved) };
		},

		async remove({ userId, chatId }) {
			const record = await store.findOwned({ id: chatId, userId });
			if (!record) return CHAT_MISSING;

			const access = await checkAccess({
				userId,
				siteId: record.siteId,
				documentKind: record.documentKind,
				documentId: record.documentId,
			});
			if (!access.ok) return refuseAccess(access);

			const removed = await store.removeOwned({ id: chatId, userId });
			return removed ? { ok: true } : CHAT_MISSING;
		},
	};
}
