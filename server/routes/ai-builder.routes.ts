import { Router, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import {
	AI_PROVIDER_IDS,
	AI_SETTINGS_LIMITS,
	AI_SETTINGS_MESSAGES,
	type AiSaveError,
	type AiSaveErrorCode,
	type AiSaveField,
	type AiStatus,
} from "@shared/ai-builder";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { readRequestSiteId } from "./shared/read-request-site-id";
import { resolveAccessibleSites } from "./shared/resolve-accessible-sites";
import { safeTryAsync } from "../utils";
import { createRateLimiter } from "../utils/rate-limit";
import { canManageCoreUpdates } from "../lib/core-update";
import { isSiteAdmin } from "../lib/site-admin-access";
import type { AiSettingsService } from "../lib/ai-builder";

/** Ten saves per person per 15 minutes. Every try counts, because each one can make the server look up a name. */
const SAVE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
const READ_LIMIT = { limit: 120, windowMs: 60 * 1000 };
/** Each test is a real (tiny, paid) model call. */
const TEST_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

const SAVE_ERROR_STATUS: Record<AiSaveErrorCode, number> = {
	not_allowed: 403,
	rate_limited: 429,
	invalid_request: 400,
	key_needed: 400,
	address_refused: 400,
	not_ready: 409,
	save_failed: 500,
};

/** Visible characters only: a key with a space or line break could not be sent as a header. */
const KEY_PATTERN = /^[\x21-\x7e]*$/;
const MODEL_PATTERN = /^[^\x00-\x1f\x7f]+$/;

const saveSchema = z.object({
	provider: z.enum(AI_PROVIDER_IDS),
	model: z.string().trim().min(1).max(AI_SETTINGS_LIMITS.model).regex(MODEL_PATTERN),
	baseUrl: z.string().trim().max(AI_SETTINGS_LIMITS.baseUrl).optional(),
	// An empty key box means "keep the saved key".
	apiKey: z
		.string()
		.trim()
		.max(AI_SETTINGS_LIMITS.apiKey)
		.regex(KEY_PATTERN)
		.optional()
		.transform((value) => (value ? value : undefined)),
});

const SAVE_FIELDS: readonly AiSaveField[] = ["provider", "model", "baseUrl", "apiKey"];

const readInvalidField = (path: readonly (string | number)[]): AiSaveField | null =>
	SAVE_FIELDS.find((field) => field === path[0]) ?? null;

const INVALID_FIELD_MESSAGES: Partial<Record<AiSaveField, string>> = {
	model: AI_SETTINGS_MESSAGES.invalidModel,
	apiKey: AI_SETTINGS_MESSAGES.invalidKey,
};

type Caller = { userId: string; siteId: string };

export type AiBuilderRouteDeps = {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	/** Dashboard session only: an API key never reads or changes AI settings. */
	requireSession: RequestHandler;
	getUserId: (req: Request) => string | null;
	service: AiSettingsService;
};

/**
 * Each site's AI settings, mounted at /api/ai-builder.
 *
 * GET    /status          anyone who can edit the site: `{ enabled, canManage }`, to show the assistant or "ask an admin".
 * GET    /settings        site owner or admin: the saved settings without the key, or `{ configured: false }`.
 * PUT    /settings        site owner or admin: `{ siteId, provider, model, baseUrl?, apiKey? }`.
 * POST   /settings/test   site owner or admin: one tiny model call that must use a tool, `{ ok }` or why not.
 * DELETE /settings        site owner or admin: removes the settings and the key.
 *
 * The assistant itself (`POST /chat`) is in `ai-builder-chat.routes.ts`.
 */
export function createAiBuilderRoutes({ models, requireSession, getUserId, service }: AiBuilderRouteDeps): Router {
	const router = Router();
	const checkRateLimit = createRateLimiter();

	const sendSaveError = ({
		res,
		code,
		message,
		field = null,
	}: {
		res: Response;
		code: AiSaveErrorCode;
		message: string;
		field?: AiSaveField | null;
	}): Response => res.status(SAVE_ERROR_STATUS[code]).json({ message, code, field } satisfies AiSaveError);

	const identify = (req: Request, res: Response): Caller | null => {
		const userId = getUserId(req);
		if (!userId) {
			res.status(401).json({ message: AI_SETTINGS_MESSAGES.signIn });
			return null;
		}
		const siteId = readRequestSiteId(req);
		if (!siteId) {
			res.status(400).json({ message: AI_SETTINGS_MESSAGES.pickSite });
			return null;
		}
		return { userId, siteId };
	};

	const canEditSite = async ({ userId, siteId }: Caller): Promise<boolean> => {
		const sites = await resolveAccessibleSites({ models, userId });
		return sites.some((site) => site.id === siteId);
	};

	/** Answers 401/400/403/500 itself and returns null; otherwise the person and site this request is about. */
	const authorize = async ({
		req,
		res,
		atFunction,
		level,
	}: {
		req: Request;
		res: Response;
		atFunction: string;
		level: "editor" | "admin";
	}): Promise<Caller | null> => {
		const caller = identify(req, res);
		if (!caller) return null;

		const { err, result: allowed } = await safeTryAsync(() =>
			level === "admin" ? isSiteAdmin({ models, ...caller }) : canEditSite(caller),
		);
		if (err) {
			console.error({ atFunction, data: { ...caller, level, error: err }, message: "Could not check who may use AI settings" });
			res.status(500).json({ message: AI_SETTINGS_MESSAGES.loadFailed });
			return null;
		}
		if (!allowed) {
			console.warn({ atFunction, data: { ...caller, level }, message: "Refused: this person may not use AI settings on this site" });
			res.status(403).json({ message: level === "admin" ? AI_SETTINGS_MESSAGES.notAllowed : AI_SETTINGS_MESSAGES.noSiteAccess });
			return null;
		}
		return caller;
	};

	const allowRead = ({ res, userId }: { res: Response; userId: string }): boolean => {
		if (checkRateLimit({ key: `read:${userId}`, ...READ_LIMIT })) return true;
		res.status(429).json({ message: AI_SETTINGS_MESSAGES.tooManyChecks });
		return false;
	};

	router.get(
		"/status",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.status";
			const caller = await authorize({ req, res, atFunction, level: "editor" });
			if (!caller || !allowRead({ res, userId: caller.userId })) return;

			const { err, result } = await safeTryAsync(async (): Promise<AiStatus> => {
				const [enabled, canManage] = await Promise.all([
					service.isEnabled({ siteId: caller.siteId }),
					isSiteAdmin({ models, ...caller }),
				]);
				return { enabled, canManage };
			});
			if (err || !result) {
				console.error({ atFunction, data: { ...caller, error: err }, message: "Could not build the assistant status" });
				return res.status(500).json({ message: AI_SETTINGS_MESSAGES.loadFailed });
			}
			res.json(result);
		}),
	);

	router.get(
		"/settings",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.settings.get";
			const caller = await authorize({ req, res, atFunction, level: "admin" });
			if (!caller || !allowRead({ res, userId: caller.userId })) return;

			const { err, result } = await safeTryAsync(() => service.getView({ siteId: caller.siteId }));
			if (err || !result) {
				console.error({ atFunction, data: { ...caller, error: err }, message: "Could not load AI settings" });
				return res.status(500).json({ message: AI_SETTINGS_MESSAGES.loadFailed });
			}
			res.json(result);
		}),
	);

	router.put(
		"/settings",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.settings.save";
			const caller = await authorize({ req, res, atFunction, level: "admin" });
			if (!caller) return;
			if (!checkRateLimit({ key: `save:${caller.userId}`, ...SAVE_LIMIT })) {
				console.warn({ atFunction, data: caller, message: "AI settings save refused: too many tries" });
				return sendSaveError({ res, code: "rate_limited", message: AI_SETTINGS_MESSAGES.rateLimited });
			}

			const parsed = saveSchema.safeParse(req.body ?? {});
			if (!parsed.success) {
				const issue = parsed.error.issues[0];
				const field = readInvalidField(issue?.path ?? []);
				// Only where and why: the body holds the key, so the values stay out of the log.
				console.warn({
					atFunction,
					data: { ...caller, issues: parsed.error.issues.map((entry) => ({ path: entry.path.join("."), code: entry.code })) },
					message: "AI settings save refused: the details were not valid",
				});
				return sendSaveError({
					res,
					code: "invalid_request",
					message: (field && INVALID_FIELD_MESSAGES[field]) || AI_SETTINGS_MESSAGES.invalidRequest,
					field,
				});
			}

			const values = parsed.data;
			const { err: accessError, result: canUsePrivateAddress } = await safeTryAsync(async () =>
				values.provider === "openai-compatible" ? canManageCoreUpdates({ models, userId: caller.userId }) : false,
			);
			if (accessError) {
				console.error({ atFunction, data: { ...caller, error: accessError }, message: "Could not check who may use local addresses" });
				return sendSaveError({ res, code: "save_failed", message: AI_SETTINGS_MESSAGES.saveFailed });
			}

			const { err, result } = await safeTryAsync(() =>
				service.save({ ...caller, values, canUsePrivateAddress: canUsePrivateAddress === true }),
			);
			if (err || !result) {
				console.error({
					atFunction,
					data: { ...caller, provider: values.provider, model: values.model, error: err },
					message: "Could not save AI settings",
				});
				return sendSaveError({ res, code: "save_failed", message: AI_SETTINGS_MESSAGES.saveFailed });
			}
			if (!result.ok) {
				console.warn({
					atFunction,
					data: { ...caller, provider: values.provider, code: result.code, field: result.field },
					message: "AI settings save refused",
				});
				return sendSaveError({ res, ...result });
			}
			res.json(result.view);
		}),
	);

	router.post(
		"/settings/test",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.settings.test";
			const caller = await authorize({ req, res, atFunction, level: "admin" });
			if (!caller) return;
			if (!checkRateLimit({ key: `test:${caller.userId}`, ...TEST_LIMIT })) {
				console.warn({ atFunction, data: caller, message: "AI connection test refused: too many tries" });
				return res.status(429).json({ message: AI_SETTINGS_MESSAGES.tooManyChecks });
			}

			const { err, result } = await safeTryAsync(() => service.testConnection({ siteId: caller.siteId }));
			if (err || !result) {
				console.error({ atFunction, data: { ...caller, error: err }, message: "Could not run the AI connection test" });
				return res.status(500).json({ message: AI_SETTINGS_MESSAGES.testFailed });
			}
			res.json(result);
		}),
	);

	router.delete(
		"/settings",
		requireSession,
		asyncHandler(async (req, res) => {
			const atFunction = "aiBuilder.settings.remove";
			const caller = await authorize({ req, res, atFunction, level: "admin" });
			if (!caller) return;

			const { err, result } = await safeTryAsync(() => service.remove(caller));
			if (err || !result) {
				console.error({ atFunction, data: { ...caller, error: err }, message: "Could not remove AI settings" });
				return res.status(500).json({ message: AI_SETTINGS_MESSAGES.removeFailed });
			}
			res.json(result);
		}),
	);

	return router;
}
