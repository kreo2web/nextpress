import { Router, type Request, type RequestHandler, type Response } from "express";
import { pipeUIMessageStreamToResponse } from "ai";
import { AI_ASSISTANT_MESSAGES, type AiChatError, type AiChatErrorCode } from "@shared/ai-builder";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { safeTryAsync } from "../utils";
import { canManageCoreUpdates } from "../lib/core-update";
import type { AiSettingsService, ResolveDns } from "../lib/ai-builder";
import { assertPageEditAccess } from "../lib/ai-builder/assert-page-edit";
import { createLanguageModel, type CreateLanguageModel } from "../lib/ai-builder/create-model";
import { readChatBody } from "../lib/ai-builder/read-chat-body";
import { recheckServiceAddress } from "../lib/ai-builder/recheck-address";
import { createRunRegistry, type RunRegistry } from "../lib/ai-builder/run-registry";
import { createAssistantStream } from "../lib/ai-builder/run-assistant";
import { createSiteLookups } from "../lib/ai-builder/site-lookups";

const CHAT_ERROR_STATUS: Record<AiChatErrorCode, number> = {
	not_allowed: 403,
	page_missing: 404,
	not_configured: 409,
	key_unreadable: 409,
	address_refused: 400,
	already_running: 409,
	hourly_limit: 429,
	invalid_request: 400,
	key_refused: 401,
	unknown_model: 400,
	busy_or_quota: 429,
	no_answer: 502,
	run_failed: 500,
};

export type AiAssistantRouteDeps = {
	models: Pick<
		Deps["models"],
		"sites" | "roles" | "userRoles" | "pages" | "posts" | "blogs" | "media" | "templates" | "themes"
	>;
	/** Dashboard session only: an API key never starts the assistant. */
	requireSession: RequestHandler;
	getUserId: (req: Request) => string | null;
	service: AiSettingsService;
	resolveDns: ResolveDns;
	/** Injected in tests; one shared registry per process otherwise. */
	registry?: RunRegistry;
	createModel?: CreateLanguageModel;
};

const once = (fn: () => Promise<void>): (() => void) => {
	let done = false;
	return () => {
		if (done) return;
		done = true;
		void fn().catch((error: Error) =>
			console.warn({ atFunction: "aiBuilder.chat", data: { error }, message: "Could not close the AI service connection" }),
		);
	};
};

/**
 * The in-editor assistant, mounted at /api/ai-builder next to the settings routes.
 *
 * POST /chat   anyone who can edit the page: `{ siteId, pageId, contentType, blocks, focusBlockId?, messages }`.
 *              Streams the reply as a UI message stream; each accepted page change arrives as a
 *              transient `data-page-change` part. Nothing is saved: the editor applies the changes
 *              to its open copy and saving stays the person's.
 */
export function createAiAssistantRoutes({
	models,
	requireSession,
	getUserId,
	service,
	resolveDns,
	registry = createRunRegistry(),
	createModel = createLanguageModel,
}: AiAssistantRouteDeps): Router {
	const router = Router();

	const refuse = ({ res, code, message }: { res: Response; code: AiChatErrorCode; message: string }): Response =>
		res.status(CHAT_ERROR_STATUS[code]).json({ message, code } satisfies AiChatError);

	router.post(
		"/chat",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.chat";
			const userId = getUserId(req);
			if (!userId) return res.status(401).json({ message: AI_ASSISTANT_MESSAGES.signIn });

			const body = readChatBody(req.body);
			if (!body.ok) {
				console.warn({ atFunction, data: { userId, issue: body.message }, message: "Assistant request refused: the details were not valid" });
				return refuse({ res, code: "invalid_request", message: AI_ASSISTANT_MESSAGES.invalidRequest });
			}
			const ids = { userId, siteId: body.siteId, pageId: body.pageId };

			const { err: setupError, result: setup } = await safeTryAsync(async () => {
				const access = await assertPageEditAccess({ models, userId, ...body });
				if (!access.ok) return { stage: "access" as const, access };
				const loaded = await service.loadForUse({ siteId: body.siteId });
				if (!loaded.ok) return { stage: "settings" as const, reason: loaded.reason };
				const allowPrivate = await canManageCoreUpdates({ models, userId: loaded.settings.updatedBy });
				const address = await recheckServiceAddress({ settings: loaded.settings, allowPrivate, resolveDns });
				return { stage: "ready" as const, settings: loaded.settings, address };
			});
			if (setupError || !setup) {
				console.error({ atFunction, data: { ...ids, error: setupError }, message: "The assistant could not start" });
				return refuse({ res, code: "run_failed", message: AI_ASSISTANT_MESSAGES.runFailed });
			}
			if (setup.stage === "access") {
				console.warn({ atFunction, data: { ...ids, code: setup.access.code }, message: "Assistant refused: this person can't edit this page" });
				return refuse({ res, code: setup.access.code, message: setup.access.message });
			}
			if (setup.stage === "settings") {
				const message = setup.reason === "key_unreadable" ? AI_ASSISTANT_MESSAGES.keyUnreadable : AI_ASSISTANT_MESSAGES.notConfigured;
				return refuse({ res, code: setup.reason, message });
			}
			if (!setup.address.ok) {
				return refuse({ res, code: "address_refused", message: setup.address.message });
			}

			const closeAddress = once(setup.address.close);
			const started = registry.tryStart({ userId });
			if (!started.ok) {
				closeAddress();
				console.warn({ atFunction, data: { ...ids, reason: started.reason }, message: "Assistant run refused by its limits" });
				const message = started.reason === "already_running" ? AI_ASSISTANT_MESSAGES.alreadyRunning : AI_ASSISTANT_MESSAGES.hourlyLimit;
				return refuse({ res, code: started.reason, message });
			}
			const { run } = started;

			// Stop in the editor (or a closed tab) ends the request; that stops the model call too.
			res.on("close", () => {
				if (!res.writableFinished) run.abort();
				run.finish();
				closeAddress();
			});

			const stream = createAssistantStream({
				model: createModel({ settings: setup.settings, fetch: setup.address.fetch }),
				provider: setup.settings.provider,
				modelName: setup.settings.model,
				blocks: body.blocks,
				focusBlockId: body.focusBlockId,
				messages: body.messages,
				site: createSiteLookups({ models, siteId: body.siteId }),
				signal: run.signal,
				ids,
				onSettled: () => {
					run.finish();
					closeAddress();
				},
			});
			pipeUIMessageStreamToResponse({ response: res, stream });
		}),
	);

	return router;
}
