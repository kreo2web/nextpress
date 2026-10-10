import type { Site } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { syncCaddyFromSites, type CaddyIo, type WebServerUpdate } from "../../utils/caddy";
import { findAddressOwner, parseSiteAddress, readSiteAddress } from "../../utils/site-address";
import { validateDomain } from "../../utils/validate-domain";
import { isSiteAdmin } from "../site-admin-access";
import { describeWebServerUpdate } from "./describe-web-server-update";

type AddressModels = Pick<Deps["models"], "sites" | "roles" | "userRoles">;
type DnsCheck = (host: string) => Promise<{ valid: boolean; message: string }>;

type AddressRefusal = { ok: false; statusCode: 400 | 403 | 404 | 409; message: string };

/** Outcome of changing a site's address. `notice` is plain-language news about the web server, if any. */
export type AddressChangeResult =
	| { ok: true; address: string | null; changed: boolean; notice: string | null }
	| AddressRefusal;

/** A typed address that may be given to a site: cleaned (`null` = no address), or why not. */
export type AddressCheckResult = { ok: true; address: string | null } | AddressRefusal;

const logWebServerUpdate = ({
	siteId,
	address,
	update,
}: {
	siteId: string;
	address: string | null;
	update: WebServerUpdate;
}): void => {
	if (update.status === "applied" && !update.warning) return;
	const detail = update.status === "applied" ? update.warning : update.reason;
	const log = update.status === "refused" ? console.error : console.warn;
	log({
		atFunction: "changeSiteAddress",
		data: { siteId, address, webServer: update.status, detail },
		message: "Web server setup after a site address change",
	});
};

/**
 * Whether a typed address may be given to a site: it must be a real address, no other site may
 * already answer on it, and a domain must already point at this server (only the main domain —
 * its `www.` twin is optional). Blank means "no address".
 */
export async function checkSiteAddress({
	sites,
	input,
	exceptSiteId,
	checkDns = validateDomain,
}: {
	sites: readonly Site[];
	input: string | null;
	exceptSiteId?: string;
	checkDns?: DnsCheck;
}): Promise<AddressCheckResult> {
	const typed = input?.trim() ?? "";
	if (!typed) return { ok: true, address: null };

	const parsed = parseSiteAddress(typed);
	if (!parsed.ok) return { ok: false, statusCode: 400, message: parsed.message };

	const owner = findAddressOwner({ sites, address: parsed.url, exceptSiteId });
	if (owner) {
		const ownerName = owner.name?.trim() || "Another site";
		return { ok: false, statusCode: 409, message: `${ownerName} already uses this address.` };
	}

	if (!parsed.isLocal) {
		const dns = await checkDns(parsed.host);
		if (!dns.valid) return { ok: false, statusCode: 400, message: dns.message };
	}

	return { ok: true, address: parsed.url };
}

/**
 * Checks, stores and serves a new address for a site. The Sites and Settings screens both come here,
 * so an address can no longer be saved in one place and missed in the other:
 * clean it → refuse one another site already uses → main domain must point here → save → web server.
 */
export async function changeSiteAddress({
	models,
	userId,
	siteId,
	input,
	checkDns = validateDomain,
	caddyIo,
}: {
	models: AddressModels;
	userId: string;
	siteId: string;
	input: string | null;
	checkDns?: DnsCheck;
	caddyIo?: CaddyIo;
}): Promise<AddressChangeResult> {
	const sites = await models.sites.findMany();
	const site = sites.find((candidate) => candidate.id === siteId);
	if (!site) return { ok: false, statusCode: 404, message: "Site not found" };

	const typed = input?.trim() ?? "";
	const parsed = typed ? parseSiteAddress(typed) : null;
	if (parsed && !parsed.ok) return { ok: false, statusCode: 400, message: parsed.message };
	const address = parsed?.ok ? parsed.url : null;

	// Compare cleaned forms: a form re-sending the address it was shown (old capitals, a slash, or
	// only kept in Settings) is not a change and must not need admin rights or a DNS check.
	const currentRaw = readSiteAddress(site);
	const current = currentRaw ? parseSiteAddress(currentRaw) : null;
	const currentUrl = current?.ok ? current.url : currentRaw;
	if ((address ?? "") === currentUrl) {
		return { ok: true, address, changed: false, notice: null };
	}

	if (!(await isSiteAdmin({ models, userId, siteId }))) {
		return { ok: false, statusCode: 403, message: "Only this site's admins can change its address." };
	}

	const checked = await checkSiteAddress({ sites, input, exceptSiteId: siteId, checkDns });
	if (!checked.ok) return checked;

	await models.sites.saveAddress({ siteId, address });
	const notice = await refreshWebServer({ models, siteId, address, caddyIo });
	return { ok: true, address, changed: true, notice };
}

/**
 * Rebuilds the web server setup after an address was stored, logs anything unusual with the site id,
 * and returns what the person should hear about it (nothing when it simply worked).
 */
export async function refreshWebServer({
	models,
	siteId,
	address,
	caddyIo,
}: {
	models: Pick<Deps["models"], "sites">;
	siteId: string;
	address: string | null;
	caddyIo?: CaddyIo;
}): Promise<string | null> {
	const update = await syncCaddyFromSites({ models, io: caddyIo });
	logWebServerUpdate({ siteId, address, update });
	return describeWebServerUpdate(update);
}
