import type { AiChatContentType, AiChatRequest } from "../ai-builder/types";

/** The kinds of document the assistant edits. Templates have no assistant, so they have no chats. */
export type AssistantChatDocumentKind = AiChatContentType;

/** The page or post a chat belongs to. The site is named too, so the server can check it against the document. */
export type AssistantChatDocument = {
	siteId: string;
	documentKind: AssistantChatDocumentKind;
	documentId: string;
};

/** One chat message as the server stores it: the editor's message shape, with the parts kept as sent. */
export type AssistantChatMessage = AiChatRequest["messages"][number];

/** One row of the chat list. Times are ISO strings so they survive the JSON round trip. */
export type AssistantChatSummary = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
};

export type AssistantChatWithMessages = AssistantChatSummary & { messages: AssistantChatMessage[] };

export type AssistantChatErrorCode =
	| "not_allowed"
	| "page_missing"
	| "chat_missing"
	| "invalid_request"
	| "too_long"
	| "rate_limited"
	| "save_failed"
	| "load_failed"
	| "delete_failed";

/** The body of a failed chat request. */
export type AssistantChatError = {
	message: string;
	code: AssistantChatErrorCode;
};
