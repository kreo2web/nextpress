import { Router, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { safeTryAsync } from "../utils";
import { createRateLimiter } from "../utils/rate-limit";
import { isReleaseVersion, type CoreUpdateStartErrorCode, type CoreUpdateStatus } from "@shared/core-update";
import { canManageCoreUpdates, type CoreUpdateService } from "../lib/core-update";

const startSchema = z.object({
	password: z.string().min(1).max(1024),
	expectedVersion: z.string().refine(isReleaseVersion),
});

/** Five starts (or password tries) per person per 15 minutes; status polling is cheap but still capped. */
const START_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
const STATUS_LIMIT = { limit: 120, windowMs: 60 * 1000 };

const START_ERROR_HTTP_STATUS: Record<CoreUpdateStartErrorCode, number> = {
	not_allowed: 403,
	rate_limited: 429,
	invalid_request: 400,
	wrong_password: 403,
	not_ready: 409,
	check_failed: 503,
	up_to_date: 409,
	version_changed: 409,
	start_failed: 500,
};

const sendStartError = ({
	res,
	code,
	message,
	status = null,
}: {
	res: Response;
	code: CoreUpdateStartErrorCode;
	message: string;
	status?: CoreUpdateStatus | null;
}): Response => res.status(START_ERROR_HTTP_STATUS[code]).json({ message, code, status });

export type CoreUpdateRouteDeps = {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	/** Dashboard session only: an API key never starts or watches an update. */
	requireSession: RequestHandler;
	getUserId: (req: Request) => string | null;
	verifyPassword: (params: { req: Request; password: string }) => Promise<boolean>;
	service: CoreUpdateService;
};

/**
 * One-click NextPress updates, mounted at /api/system/update.
 *
 * GET  /status — main-site admins get the full status; anyone else `{ canManage: false }`.
 * POST /start  — `{ password, expectedVersion }`; leaves a request for the host runner and answers 202.
 */
export function createCoreUpdateRoutes({
	models,
	requireSession,
	getUserId,
	verifyPassword,
	service,
}: CoreUpdateRouteDeps): Router {
	const router = Router();
	const checkRateLimit = createRateLimiter();

	router.get(
		"/status",
		requireSession,
		asyncHandler(async (req, res) => {
			const userId = getUserId(req);
			if (!userId) return res.status(401).json({ message: "Sign in again to continue." });
			if (!checkRateLimit({ key: `status:${userId}`, ...STATUS_LIMIT })) {
				return res.status(429).json({ message: "Too many checks. Wait a moment, then try again." });
			}

			const { err, result } = await safeTryAsync(async (): Promise<CoreUpdateStatus> => {
				if (!(await canManageCoreUpdates({ models, userId }))) return { canManage: false };
				return service.getStatus();
			});
			if (err || !result) {
				console.error({ atFunction: "coreUpdate.status", data: { userId, error: err }, message: "Could not build update status" });
				return res.status(500).json({ message: "The update status couldn't be loaded. Try again." });
			}
			res.json(result);
		}),
	);

	router.post(
		"/start",
		requireSession,
		asyncHandler(async (req, res) => {
			const userId = getUserId(req);
			if (!userId) return res.status(401).json({ message: "Sign in again to continue." });

			const { err: accessError, result: allowed } = await safeTryAsync(() => canManageCoreUpdates({ models, userId }));
			if (accessError) {
				console.error({ atFunction: "coreUpdate.start", data: { userId, error: accessError }, message: "Could not check update access" });
				return sendStartError({ res, code: "start_failed", message: "The update couldn't be started. Try again." });
			}
			if (!allowed) {
				return sendStartError({ res, code: "not_allowed", message: "Only the main site's admins can update NextPress." });
			}
			// Counted before the password check, so the limit also caps password guesses.
			if (!checkRateLimit({ key: `start:${userId}`, ...START_LIMIT })) {
				return sendStartError({ res, code: "rate_limited", message: "Too many tries. Wait a few minutes, then try again." });
			}

			const parsed = startSchema.safeParse(req.body ?? {});
			if (!parsed.success) {
				return sendStartError({ res, code: "invalid_request", message: "Enter your password to start the update." });
			}

			const { err: passwordError, result: passwordOk } = await safeTryAsync(() =>
				verifyPassword({ req, password: parsed.data.password }),
			);
			if (passwordError) {
				console.error({ atFunction: "coreUpdate.start", data: { userId, error: passwordError }, message: "Could not check the password" });
				return sendStartError({ res, code: "start_failed", message: "Your password couldn't be checked. Try again." });
			}
			if (!passwordOk) {
				console.warn({ atFunction: "coreUpdate.start", data: { userId }, message: "Wrong password on update confirm" });
				return sendStartError({ res, code: "wrong_password", message: "That password isn't right. Try again." });
			}

			const { err, result } = await safeTryAsync(() =>
				service.start({ userId, expectedVersion: parsed.data.expectedVersion }),
			);
			if (err || !result) {
				console.error({
					atFunction: "coreUpdate.start",
					data: { userId, expectedVersion: parsed.data.expectedVersion, error: err },
					message: "Could not leave the update request",
				});
				return sendStartError({ res, code: "start_failed", message: "The update couldn't be started. Try again." });
			}
			if (!result.ok) {
				return sendStartError({ res, code: result.code, message: result.message, status: result.status });
			}
			res.status(202).json({ started: result.started, status: result.status });
		}),
	);

	return router;
}
