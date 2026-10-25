import express, { Router, type ErrorRequestHandler, type Request, type RequestHandler, type Response } from "express";
import {
	ASSISTANT_CHAT_LIMITS,
	ASSISTANT_CHAT_MESSAGES,
	type AssistantChatError,
	type AssistantChatErrorCode,
} from "@shared/assistant-chats";
import { asyncHandler } from "./shared/async-handler";
import { safeTryAsync } from "../utils";
import { createRateLimiter } from "../utils/rate-limit";
import { assertPageEditAccess, type PageEditModels } from "../lib/ai-builder/assert-page-edit";
import {
	createAssistantChatService,
	isChatId,
	readChatSave,
	readDocumentQuery,
	type AssistantChatStore,
	type ChatRefusal,
} from "../lib/assistant-chats";

/** Reads of the chat list and of one chat: generous, a person flips between chats. */
const READ_LIMIT = { limit: 120, windowMs: 60 * 1000 };
/** Saves and deletes: a save follows each finished assistant reply, which takes seconds, so this is far above normal use. */
const WRITE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

/** The largest save request the server reads: the biggest chat plus the ids around it. */
export const ASSISTANT_CHAT_BODY_LIMIT_BYTES = ASSISTANT_CHAT_LIMITS.bytesPerChat + ASSISTANT_CHAT_LIMITS.requestEnvelopeBytes;

type ErrorStatus = Record<AssistantChatErrorCode, number>;

const ERROR_STATUS: ErrorStatus = {
	not_allowed: 403,
	page_missing: 404,
	chat_missing: 404,
	invalid_request: 400,
	too_long: 413,
	rate_limited: 429,
	save_failed: 500,
	load_failed: 500,
	delete_failed: 500,
};

export type AssistantChatsRouteDeps = {
	models: PageEditModels & { assistantChats: AssistantChatStore };
	/** Dashboard session only: an API key never reads a person's chats. */
	requireSession: RequestHandler;
	getUserId: (req: Request) => string | null;
	/** Injected in tests so saves land in a known order. */
	now?: () => Date;
};

const sendError = ({ res, code, message }: { res: Response; code: AssistantChatErrorCode; message: string }): Response =>
	res.status(ERROR_STATUS[code]).json({ message, code } satisfies AssistantChatError);

const sendRefusal = ({ res, refusal }: { res: Response; refusal: ChatRefusal }): Response =>
	res.status(refusal.status).json({ message: refusal.message, code: refusal.code } satisfies AssistantChatError);

const isBodyTooLarge = (error: Error): boolean => "type" in error && error.type === "entity.too.large";

/**
 * Reads a chat save with a bigger limit than the app-wide default, after checking the person is signed in
 * (an anonymous caller never makes the server read a quarter of a megabyte). A request over the limit gets the
 * same plain answer as a chat that is too long once read. Mount it on `PUT /api/assistant/chats/:chatId`
 * before the app's general body reader, which would refuse it first.
 */
export function createAssistantChatBodyParser({
	requireSession,
	getUserId,
}: Pick<AssistantChatsRouteDeps, "requireSession" | "getUserId">): Array<RequestHandler | ErrorRequestHandler> {
	const refuseTooLarge: ErrorRequestHandler = (error: Error, req, res, next) => {
		if (!isBodyTooLarge(error)) {
			next(error);
			return;
		}
		console.warn({
			atFunction: "assistantChats.readBody",
			data: { userId: getUserId(req), chatId: req.params.chatId, limit: ASSISTANT_CHAT_BODY_LIMIT_BYTES, error },
			message: "Chat save refused: the request was larger than any chat may be",
		});
		sendError({ res, code: "too_long", message: ASSISTANT_CHAT_MESSAGES.tooLong });
	};
	return [requireSession, express.json({ limit: ASSISTANT_CHAT_BODY_LIMIT_BYTES }), refuseTooLarge];
}

/**
 * A person's saved assistant chats, mounted at /api/assistant/chats. Each chat belongs to one person and one
 * page or post; nobody sees or changes anyone else's, and every call re-checks that the person may still use
 * the assistant on that page's site.
 *
 * GET    /?siteId=&documentKind=&documentId=   this person's chats for the page or post: id, title and times, newest first, at most 20.
 * GET    /:chatId                              one chat with its messages.
 * PUT    /:chatId                              `{ siteId, documentKind, documentId, messages }` creates or updates it; the same chat saved twice is harmless.
 * DELETE /:chatId                              removes it.
 */
export function createAssistantChatsRoutes({ models, requireSession, getUserId, now }: AssistantChatsRouteDeps): Router {
	const router = Router();
	const checkRate = createRateLimiter();
	const service = createAssistantChatService({
		store: models.assistantChats,
		checkAccess: ({ userId, siteId, documentId, documentKind }) =>
			assertPageEditAccess({ models, userId, siteId, pageId: documentId, contentType: documentKind }),
		now,
	});

	/** Answers 401 itself and returns null; otherwise the signed-in person. */
	const identify = ({ req, res }: { req: Request; res: Response }): string | null => {
		const userId = getUserId(req);
		if (userId) return userId;
		res.status(401).json({ message: ASSISTANT_CHAT_MESSAGES.signIn });
		return null;
	};

	const allow = ({ res, userId, kind }: { res: Response; userId: string; kind: "read" | "write" }): boolean => {
		const limit = kind === "read" ? READ_LIMIT : WRITE_LIMIT;
		if (checkRate({ key: `${kind}:${userId}`, ...limit })) return true;
		sendError({ res, code: "rate_limited", message: ASSISTANT_CHAT_MESSAGES.tooManyChanges });
		return false;
	};

	/** Runs the service call and turns its three outcomes (failed, refused, done) into the response and the logs. */
	const answer = async <Done extends { ok: true }>({
		res,
		atFunction,
		ids,
		failure,
		work,
		send,
	}: {
		res: Response;
		atFunction: string;
		ids: Record<string, string | undefined>;
		failure: { code: AssistantChatErrorCode; message: string; log: string };
		work: () => Promise<Done | ChatRefusal>;
		send: (done: Done) => void;
	}): Promise<void> => {
		const { err, result } = await safeTryAsync(work);
		if (err || !result) {
			console.error({ atFunction, data: { ...ids, error: err }, message: failure.log });
			sendError({ res, code: failure.code, message: failure.message });
			return;
		}
		if (!result.ok) {
			console.warn({ atFunction, data: { ...ids, code: result.code }, message: "Assistant chat request refused" });
			sendRefusal({ res, refusal: result });
			return;
		}
		send(result);
	};

	const refuseUnknownChat = ({ res, atFunction, userId, chatId }: { res: Response; atFunction: string; userId: string; chatId: string | undefined }): void => {
		console.warn({ atFunction, data: { userId, chatId }, message: "Assistant chat request refused: not a chat id" });
		sendError({ res, code: "chat_missing", message: ASSISTANT_CHAT_MESSAGES.chatMissing });
	};

	router.get(
		"/",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "assistantChats.list";
			const userId = identify({ req, res });
			if (!userId || !allow({ res, userId, kind: "read" })) return;

			const query = readDocumentQuery(req.query);
			if (!query.ok) {
				console.warn({ atFunction, data: { userId, issue: query.message }, message: "Chat list refused: the details were not valid" });
				sendError({ res, code: "invalid_request", message: ASSISTANT_CHAT_MESSAGES.invalidRequest });
				return;
			}

			await answer({
				res,
				atFunction,
				ids: { userId, ...query.document },
				failure: { code: "load_failed", message: ASSISTANT_CHAT_MESSAGES.loadFailed, log: "Could not load the saved chats" },
				work: () => service.list({ userId, document: query.document }),
				send: ({ chats }) => void res.json({ chats }),
			});
		}),
	);

	router.get(
		"/:chatId",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "assistantChats.read";
			const userId = identify({ req, res });
			if (!userId || !allow({ res, userId, kind: "read" })) return;

			const { chatId } = req.params;
			if (!isChatId(chatId)) return refuseUnknownChat({ res, atFunction, userId, chatId });

			await answer({
				res,
				atFunction,
				ids: { userId, chatId },
				failure: { code: "load_failed", message: ASSISTANT_CHAT_MESSAGES.openFailed, log: "Could not load the chat" },
				work: () => service.read({ userId, chatId }),
				send: ({ chat }) => void res.json({ chat }),
			});
		}),
	);

	router.put(
		"/:chatId",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "assistantChats.save";
			const userId = identify({ req, res });
			if (!userId || !allow({ res, userId, kind: "write" })) return;

			const { chatId } = req.params;
			if (!isChatId(chatId)) return refuseUnknownChat({ res, atFunction, userId, chatId });

			const body = readChatSave(req.body);
			if (!body.ok) {
				console.warn({ atFunction, data: { userId, chatId, issue: body.message }, message: "Chat save refused: the details were not valid" });
				sendError({ res, code: "invalid_request", message: ASSISTANT_CHAT_MESSAGES.invalidRequest });
				return;
			}

			await answer({
				res,
				atFunction,
				ids: { userId, chatId, ...body.document },
				failure: { code: "save_failed", message: ASSISTANT_CHAT_MESSAGES.saveFailed, log: "Could not save the chat" },
				work: () => service.save({ userId, chatId, document: body.document, messages: body.messages }),
				send: ({ chat }) => void res.json({ chat }),
			});
		}),
	);

	router.delete(
		"/:chatId",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "assistantChats.remove";
			const userId = identify({ req, res });
			if (!userId || !allow({ res, userId, kind: "write" })) return;

			const { chatId } = req.params;
			if (!isChatId(chatId)) return refuseUnknownChat({ res, atFunction, userId, chatId });

			await answer({
				res,
				atFunction,
				ids: { userId, chatId },
				failure: { code: "delete_failed", message: ASSISTANT_CHAT_MESSAGES.deleteFailed, log: "Could not delete the chat" },
				work: () => service.remove({ userId, chatId }),
				send: () => void res.json({ ok: true }),
			});
		}),
	);

	return router;
}
