import type { NextFunction, Request, RequestHandler, Response } from "express";

/** The dashboard, setup and API: never shown inside another site's frame. */
const PRIVATE_PATHS = /^\/(admin|api|setup)(\/|$)/;

/**
 * Security headers on every response. Always on: the old "Security Headers" switch set nothing.
 * Published pages may still be framed (site owners embed them); the dashboard and API may not.
 */
export function securityHeaders(): RequestHandler {
	return (req: Request, res: Response, next: NextFunction): void => {
		res.setHeader("X-Content-Type-Options", "nosniff");
		res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
		if (PRIVATE_PATHS.test(req.path)) {
			res.setHeader("X-Frame-Options", "SAMEORIGIN");
			res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
		}
		next();
	};
}
