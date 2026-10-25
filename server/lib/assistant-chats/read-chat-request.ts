import { z } from "zod";
import type { AssistantChatDocument, AssistantChatMessage } from "@shared/assistant-chats";

const uuid = z.string().uuid();

const documentSchema = z.object({
	siteId: uuid,
	documentKind: z.enum(["page", "post"]),
	documentId: uuid,
});

/** The editor's own message shape; parts keep whatever else they carry (tool steps have many fields). */
const messageSchema = z.object({
	id: z.string().min(1).max(200),
	role: z.enum(["system", "user", "assistant"]),
	parts: z.array(z.object({ type: z.string().min(1).max(100) }).passthrough()).min(1),
});

/**
 * No count is set on `messages`: the editor sends the whole conversation and the service keeps the newest
 * ones. How big a save can be is bounded by the request size and the chat size cap instead.
 */
const saveSchema = documentSchema.extend({ messages: z.array(messageSchema).min(1) });

export type ReadDocument = { ok: true; document: AssistantChatDocument } | { ok: false; message: string };

export type ReadChatSave =
	| { ok: true; document: AssistantChatDocument; messages: AssistantChatMessage[] }
	| { ok: false; message: string };

const firstIssue = (error: z.ZodError): string => error.issues[0]?.message ?? "invalid";

/** The page or post a list request is about (`?siteId=&documentKind=&documentId=`). */
export const readDocumentQuery = (query: object): ReadDocument => {
	const parsed = documentSchema.safeParse(query);
	return parsed.success ? { ok: true, document: parsed.data } : { ok: false, message: firstIssue(parsed.error) };
};

/** A save request: the page or post, and the conversation. */
export const readChatSave = (body: object | null | undefined): ReadChatSave => {
	const parsed = saveSchema.safeParse(body ?? {});
	if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
	const { messages, ...document } = parsed.data;
	return { ok: true, document, messages: messages as AssistantChatMessage[] };
};

/** Chat ids are UUIDs; anything else is "no such chat" without asking the database (it would error). */
export const isChatId = (value: string | undefined): value is string => uuid.safeParse(value).success;
