import { Router } from "express";
import { ACCESS_MESSAGES } from "@shared/access";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { readRequestSiteId } from "./shared/read-request-site-id";
import { getRequestAuthSiteId } from "../auth";
import { isMainSiteAdmin, readSiteAccess } from "../lib/access";
import { safeTryAsync } from "../utils";

/**
 * GET /api/access?siteId=  What the signed-in person (or an API key's maker) may do on one site, so
 * the dashboard shows only what works. The server checks every action again on its own.
 * Without a site it answers only whether they run the install.
 */
export function createAccessRoutes({ models, requireAuth, authService }: Pick<Deps, "models" | "requireAuth" | "authService">): Router {
	const router = Router();

	router.get("/", requireAuth, asyncHandler(async (req, res) => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) return res.status(401).json({ message: ACCESS_MESSAGES.signIn });
		const siteId = readRequestSiteId(req) ?? getRequestAuthSiteId(req);

		const { err, result } = await safeTryAsync(async () =>
			siteId ? readSiteAccess({ models, userId, siteId }) : { isMainSiteAdmin: await isMainSiteAdmin({ models, userId }) },
		);
		if (err || !result) {
			console.error({ atFunction: "access.read", data: { userId, siteId: siteId ?? null, error: err }, message: "Could not read what this person may do" });
			return res.status(500).json({ message: "Something went wrong. Try again." });
		}
		res.json(result);
	}));

	return router;
}
