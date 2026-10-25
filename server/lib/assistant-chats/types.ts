import type { AssistantChatDocumentKind, AssistantChatMessage } from "@shared/assistant-chats";

/** One saved chat as the rest of the server sees it. */
export type AssistantChatRecord = {
	id: string;
	siteId: string;
	userId: string;
	documentKind: AssistantChatDocumentKind;
	documentId: string;
	title: string;
	messages: AssistantChatMessage[];
	createdAt: Date;
	updatedAt: Date;
};

/** What the chat list needs. The messages stay in the database: a list of 20 chats must not read 20 conversations. */
export type AssistantChatSummaryRecord = Pick<AssistantChatRecord, "id" | "title" | "createdAt" | "updatedAt">;

export type SaveOwnedChatInput = {
	id: string;
	userId: string;
	siteId: string;
	documentKind: AssistantChatDocumentKind;
	documentId: string;
	title: string;
	messages: AssistantChatMessage[];
	/** The time to record, so the whole save agrees on one moment. */
	now: Date;
};

/**
 * Everything the chat rules need from storage. Every call is tied to a person: there is no way to ask for
 * a chat without saying whose it is, so a route can't hand out someone else's by mistake.
 */
export type AssistantChatStore = {
	findOwned: (params: { id: string; userId: string }) => Promise<AssistantChatRecord | undefined>;
	/** Newest first. */
	listSummaries: (params: {
		userId: string;
		documentKind: AssistantChatDocumentKind;
		documentId: string;
		limit: number;
	}) => Promise<AssistantChatSummaryRecord[]>;
	/**
	 * Creates the chat, or replaces its messages when this person already has it for the same page.
	 * Answers nothing when the id belongs to someone else or to another page: that chat is left alone.
	 */
	saveOwned: (chat: SaveOwnedChatInput) => Promise<AssistantChatRecord | undefined>;
	removeOwned: (params: { id: string; userId: string }) => Promise<boolean>;
	removeOwnedMany: (params: { ids: string[]; userId: string }) => Promise<void>;
	/**
	 * Everyone's chats about one page or post, when that page or post is deleted. The only removal
	 * not tied to one person: the document they were about is gone, so nobody can open them again.
	 */
	removeForDocument: (params: { documentKind: AssistantChatDocumentKind; documentId: string }) => Promise<void>;
};
