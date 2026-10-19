import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ACCESS_MESSAGES } from "@shared/access";
import { getRequestAuthUserId } from "../../auth";
import { isMainSiteAdmin, type AccessModels } from "./site-standing";

/**
 * Route guard for install-wide things (plugins, all users, sites): only owners and admins of the
 * main site pass. Put it after `requireAuth`.
 */
export function requireMainSiteAdmin({ models }: { models: AccessModels }): RequestHandler {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		const userId = getRequestAuthUserId(req);
		if (!userId) {
			res.status(401).json({ message: ACCESS_MESSAGES.signIn });
			return;
		}
		try {
			if (await isMainSiteAdmin({ models, userId })) return next();
			console.warn({ atFunction: "access.requireMainSiteAdmin", data: { userId, path: req.path }, message: "Refused: main-site admins only" });
			res.status(403).json({ message: ACCESS_MESSAGES.mainSiteOnly });
		} catch (error) {
			console.error({ atFunction: "access.requireMainSiteAdmin", data: { userId, path: req.path, error }, message: "Could not check who is a main-site admin" });
			res.status(500).json({ message: "Something went wrong. Try again." });
		}
	};
}
