import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ACCESS_MESSAGES } from "@shared/access";
import type { Site } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { normalizeSiteHostname } from "../../utils/validate-domain";

type SignUpModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;

/** The site a web sign-up is for: the one whose address the request came to, else the main site. */
export async function findSignUpSite({ models, host }: { models: SignUpModels; host: string | null | undefined }): Promise<Site | undefined> {
	const hostname = normalizeSiteHostname(host ?? "");
	const matched = hostname ? await models.sites.findByHostname(hostname) : undefined;
	return matched ?? models.sites.findDefaultSite();
}

/** Settings → Discussion → "Let visitors create an account" (stored as `enableRegistration`; off unless turned on). */
export async function allowsVisitorAccounts({ models, siteId }: { models: SignUpModels; siteId: string }): Promise<boolean> {
	const settings = (await models.sites.getSettings(siteId)) as { discussion?: { enableRegistration?: boolean } } | null;
	return settings?.discussion?.enableRegistration === true;
}

/**
 * Sits in front of Better Auth's web sign-up. Each site decides for itself; a site that hasn't
 * turned visitor accounts on refuses. The setup wizard, admins and invite links make accounts
 * through `auth.api` on the server and never pass through here.
 */
export function createSignUpGate({ models }: { models: SignUpModels }): RequestHandler {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		if (req.method !== "POST") return next();
		try {
			const site = await findSignUpSite({ models, host: req.get("host") });
			if (site && (await allowsVisitorAccounts({ models, siteId: site.id }))) return next();
			console.warn({
				atFunction: "accounts.signUpGate",
				data: { host: req.get("host") ?? null, siteId: site?.id ?? null },
				message: "Refused a web sign-up: this site doesn't take visitor accounts",
			});
			res.status(403).json({ message: ACCESS_MESSAGES.signUpClosed, code: "SIGN_UP_CLOSED" });
		} catch (error) {
			console.error({ atFunction: "accounts.signUpGate", data: { host: req.get("host") ?? null, error }, message: "Could not check whether sign-up is open" });
			res.status(500).json({ message: "We couldn't create your account right now. Try again in a moment." });
		}
	};
}

/**
 * Gives a person who signed up on the web the subscriber role on the site they signed up on, and
 * nothing more. A self sign-up can never become an editor or admin; only an admin or an invite can.
 */
export async function giveVisitorRole({ models, userId, host }: { models: SignUpModels; userId: string; host: string | null }): Promise<void> {
	const site = await findSignUpSite({ models, host });
	if (!site || !(await allowsVisitorAccounts({ models, siteId: site.id }))) {
		console.warn({ atFunction: "accounts.giveVisitorRole", data: { userId, host, siteId: site?.id ?? null }, message: "Web sign-up got no role: the site doesn't take visitor accounts" });
		return;
	}
	const subscriber = await models.roles.findByName("subscriber");
	if (!subscriber) {
		console.error({ atFunction: "accounts.giveVisitorRole", data: { userId, siteId: site.id }, message: "No subscriber role exists, so the new account got no role" });
		return;
	}
	await models.userRoles.assignRole(userId, subscriber.id, site.id);
}
