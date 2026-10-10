import type { Site } from "@shared/schema-types";
import { getCaddyTlsHostnames, shouldSkipPublicDnsCheck } from "./validate-domain";

/** A typed site address cleaned into the one stored form, or why it can't be one. */
export type ParsedSiteAddress =
	| { ok: true; url: string; host: string; isLocal: boolean }
	| { ok: false; message: string };

type SiteAddressSource = Pick<Site, "siteUrl" | "settings">;
type RankedSite = Pick<Site, "id" | "isDefault" | "createdAt">;

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WEB_SCHEMES = new Set(["http:", "https:"]);
/** Dotted DNS name with letter-led last label. Anything else would also break the Caddyfile. */
const PUBLIC_HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;

/** True when `host` is a plain public domain name, safe to hand to Caddy. */
export function isPublicHostname(host: string): boolean {
	return PUBLIC_HOSTNAME.test(host);
}

/**
 * Cleans a typed address into the form we store and compare: lower-case host, no path, `https://`
 * for domains (the web server always serves them over HTTPS), and `http://` with the port kept for
 * IP addresses and localhost (no certificate is possible there). Visitors are matched to sites by
 * this host, so `Site.com/` and `site.com` must end up the same.
 */
export function parseSiteAddress(input: string): ParsedSiteAddress {
	const typed = input.trim();
	if (!typed) return { ok: false, message: "Enter an address, like example.com." };

	const candidate = HAS_SCHEME.test(typed) ? typed : `http://${typed}`;
	if (!URL.canParse(candidate)) {
		return { ok: false, message: `"${typed}" is not a web address. Use a domain like example.com.` };
	}

	const url = new URL(candidate);
	if (!WEB_SCHEMES.has(url.protocol)) {
		return { ok: false, message: "Use a web address that starts with http:// or https://." };
	}

	const host = url.hostname.toLowerCase().replace(/\.$/, "");
	if (shouldSkipPublicDnsCheck(host)) {
		const port = url.port ? `:${url.port}` : "";
		return { ok: true, url: `http://${host}${port}`, host, isLocal: true };
	}

	if (!isPublicHostname(host)) {
		return { ok: false, message: `"${host}" is not a domain name. Use something like example.com.` };
	}
	return { ok: true, url: `https://${host}`, host, isLocal: false };
}

const readSettingsAddress = (settings: Site["settings"]): string => {
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
	const general = (settings as { general?: { siteUrl?: string | null } }).general;
	return typeof general?.siteUrl === "string" ? general.siteUrl.trim() : "";
};

/**
 * Where a site is reached. The site record's own field is the one home; sites saved before it was
 * may only have the address in Settings, so that is read when the record has none.
 */
export function readSiteAddress(site: SiteAddressSource): string {
	const fromRecord = site.siteUrl?.trim();
	if (fromRecord) return fromRecord;
	return readSettingsAddress(site.settings);
}

/** True when a visitor host (lower case, no port) belongs to this site, `www.` twin included. */
export function siteAnswersHost({ site, host }: { site: SiteAddressSource; host: string }): boolean {
	const address = readSiteAddress(site);
	if (!address || !host) return false;
	return getCaddyTlsHostnames(address).includes(host);
}

const createdAtTime = (site: RankedSite): number => (site.createdAt ? site.createdAt.getTime() : 0);

/** Default site first, then oldest, then by id: a fixed order that never depends on database row order. */
export function compareSitePreference(left: RankedSite, right: RankedSite): number {
	if (Boolean(left.isDefault) !== Boolean(right.isDefault)) return left.isDefault ? -1 : 1;
	const byAge = createdAtTime(left) - createdAtTime(right);
	return byAge !== 0 ? byAge : left.id.localeCompare(right.id);
}

/**
 * Picks one site when several claim the same host: the default site, then the oldest. Without a
 * fixed order the database decided, and a new empty site could take over the default site's address.
 */
export function pickPreferredSite<T extends RankedSite>(sites: readonly T[]): T | undefined {
	return [...sites].sort(compareSitePreference)[0];
}

/** Another site that already answers on any host of `address` (`www.` twin included), if one does. */
export function findAddressOwner<T extends SiteAddressSource & { id: string }>({
	sites,
	address,
	exceptSiteId,
}: {
	sites: readonly T[];
	address: string;
	exceptSiteId?: string;
}): T | undefined {
	const wanted = new Set(getCaddyTlsHostnames(address));
	if (wanted.size === 0) return undefined;
	return sites.find(
		(site) =>
			site.id !== exceptSiteId &&
			getCaddyTlsHostnames(readSiteAddress(site)).some((host) => wanted.has(host)),
	);
}
