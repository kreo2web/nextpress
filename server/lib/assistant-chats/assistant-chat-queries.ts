import { and, desc, eq, inArray } from "drizzle-orm";
import { assistantChats } from "@shared/schema";
import type { DatabaseInstance } from "@shared/create-models";
import type { SaveOwnedChatInput } from "./types";

/*
 * The statements behind the chat model, built but not run. WHY separate: the model awaits them, and a test
 * can print them (`.toSQL()`) to prove every one of them is tied to the person who owns the chat.
 */

export const selectOwnedChat = ({ db, id, userId }: { db: DatabaseInstance; id: string; userId: string }) =>
	db
		.select()
		.from(assistantChats)
		.where(and(eq(assistantChats.id, id), eq(assistantChats.userId, userId)))
		.limit(1);

/** Only the list columns: the messages are the heavy part and the list never shows them. */
export const selectDocumentSummaries = ({
	db,
	userId,
	documentKind,
	documentId,
	limit,
}: {
	db: DatabaseInstance;
	userId: string;
	documentKind: string;
	documentId: string;
	limit: number;
}) =>
	db
		.select({
			id: assistantChats.id,
			title: assistantChats.title,
			createdAt: assistantChats.createdAt,
			updatedAt: assistantChats.updatedAt,
		})
		.from(assistantChats)
		.where(
			and(
				eq(assistantChats.userId, userId),
				eq(assistantChats.documentKind, documentKind),
				eq(assistantChats.documentId, documentId),
			),
		)
		.orderBy(desc(assistantChats.updatedAt))
		.limit(limit);

/**
 * One statement, so two saves of the same new chat can't both insert it. When the id is already taken,
 * the existing row is only touched if it is this person's chat for this page (`setWhere`); otherwise nothing
 * changes and nothing comes back, so one person can never overwrite another's chat by guessing its id.
 */
export const upsertOwnedChat = ({ db, chat }: { db: DatabaseInstance; chat: SaveOwnedChatInput }) =>
	db
		.insert(assistantChats)
		.values({
			id: chat.id,
			siteId: chat.siteId,
			userId: chat.userId,
			documentKind: chat.documentKind,
			documentId: chat.documentId,
			title: chat.title,
			messages: chat.messages,
			createdAt: chat.now,
			updatedAt: chat.now,
		})
		.onConflictDoUpdate({
			target: assistantChats.id,
			set: { messages: chat.messages, updatedAt: chat.now },
			setWhere: and(
				eq(assistantChats.userId, chat.userId),
				eq(assistantChats.siteId, chat.siteId),
				eq(assistantChats.documentKind, chat.documentKind),
				eq(assistantChats.documentId, chat.documentId),
			),
		})
		.returning();

export const deleteOwnedChat = ({ db, id, userId }: { db: DatabaseInstance; id: string; userId: string }) =>
	db
		.delete(assistantChats)
		.where(and(eq(assistantChats.id, id), eq(assistantChats.userId, userId)))
		.returning({ id: assistantChats.id });

export const deleteOwnedChats = ({ db, ids, userId }: { db: DatabaseInstance; ids: string[]; userId: string }) =>
	db
		.delete(assistantChats)
		.where(and(inArray(assistantChats.id, ids), eq(assistantChats.userId, userId)));

export const deleteDocumentChats = ({ db, documentKind, documentId }: { db: DatabaseInstance; documentKind: string; documentId: string }) =>
	db
		.delete(assistantChats)
		.where(and(eq(assistantChats.documentKind, documentKind), eq(assistantChats.documentId, documentId)));
