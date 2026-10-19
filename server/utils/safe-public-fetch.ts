import { isIP } from "node:net";
import { classifyIp, strictestReach } from "../lib/ai-builder/classify-ip";
import { lookupHostAddresses, type ResolveDns } from "../lib/ai-builder/check-service-address";
import { createPinnedFetch } from "../lib/ai-builder/pinned-fetch";
import { safeTryAsync } from "../utils";

/** A fetch that only reaches the open internet (WordPress import, remote images). */
export type PublicFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type PublicAddressCheck =
	| { ok: true; url: URL; host: string; addresses: string[] }
	| { ok: false; message: string; cause?: Error };

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const refuse = (message: string, cause?: Error): PublicAddressCheck => ({ ok: false, message, ...(cause ? { cause } : {}) });

const isLocalName = (host: string): boolean => host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal");

/**
 * Whether the server may fetch this address on someone's behalf: http(s), no login in it, and every
 * address the name leads to (IPv4 and IPv6) on the open internet. A failed lookup refuses: an address
 * that can't be checked is never fetched. The same rules as the AI service check, minus local addresses.
 */
export async function checkPublicAddress({ input, resolveDns = lookupHostAddresses }: { input: string; resolveDns?: ResolveDns }): Promise<PublicAddressCheck> {
	if (!URL.canParse(input)) return refuse("That address isn't valid.");
	const url = new URL(input);
	if (url.protocol !== "http:" && url.protocol !== "https:") return refuse("Only http and https addresses can be used.");
	if (url.username || url.password) return refuse("Remove the login from the address.");

	const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.+$/, "");
	if (!host || isLocalName(host)) return refuse("That address points to this server or a private network.");

	let addresses: string[];
	if (isIP(host)) {
		addresses = [host];
	} else {
		const { err, result } = await safeTryAsync(() => resolveDns(host));
		if (err || !result || result.length === 0) return refuse("We couldn't find that address. Check it and try again.", err ?? undefined);
		addresses = result;
	}
	if (strictestReach(addresses.map(classifyIp)) !== "public") {
		return refuse("That address points to this server or a private network.");
	}
	return { ok: true, url, host, addresses };
}

/**
 * A fetch for addresses people type in. Each hop is checked, then connected to only the IPs just
 * checked (no second lookup for a rebinding trick), and redirects are followed by hand so every new
 * address is checked too.
 */
export function createSafePublicFetch({ resolveDns = lookupHostAddresses }: { resolveDns?: ResolveDns } = {}): PublicFetch {
	return async (input, init) => {
		let current = input;
		for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
			const check = await checkPublicAddress({ input: current, resolveDns });
			if (!check.ok) throw Object.assign(new Error(`Refused to fetch ${current}: ${check.message}`), { cause: check.cause, userMessage: check.message });

			const pinned = createPinnedFetch({ host: check.host, addresses: check.addresses, redirect: "manual" });
			const response = await pinned.fetch(check.url.toString(), init);
			const location = response.headers.get("location");
			if (!REDIRECT_STATUSES.has(response.status) || !location) return response;

			await response.body?.cancel();
			void pinned.close();
			current = new URL(location, check.url).toString();
		}
		throw new Error(`Refused to fetch ${input}: more than ${MAX_REDIRECTS} redirects`);
	};
}
