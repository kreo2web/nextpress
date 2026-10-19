import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AI_SETTINGS_MESSAGES } from "@shared/ai-builder";
import { safeTryAsync } from "../../utils";
import { classifyIp, strictestReach, type AddressReach } from "./classify-ip";

/**
 * Looks a name up and returns every address it leads to, IPv4 and IPv6. It rejects when the name can't be
 * found. Injected so tests never touch the network.
 */
export type ResolveDns = (hostname: string) => Promise<string[]>;

/** A slow or silent name server must not hold a save open. */
const LOOKUP_TIMEOUT_MS = 5000;

/**
 * The real lookup. It asks the system resolver, the same one the later connection uses, so a name that
 * only exists in the server's hosts file (such as host.docker.internal) is judged by what it really reaches.
 */
export const lookupHostAddresses: ResolveDns = async (hostname) => {
	let timer: NodeJS.Timeout | undefined;
	const tooSlow = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => reject(new Error(`Looking up ${hostname} took longer than ${LOOKUP_TIMEOUT_MS} ms`)), LOOKUP_TIMEOUT_MS);
	});
	try {
		const records = await Promise.race([lookup(hostname, { all: true, verbatim: true }), tooSlow]);
		return records.map((record) => record.address);
	} finally {
		clearTimeout(timer);
	}
};

export type AddressRefusalCode =
	| "invalid"
	| "has_login"
	| "needs_https"
	| "not_public"
	| "not_allowed"
	| "lookup_failed";

export type ServiceAddressCheck =
	| {
			ok: true;
			/** The address as it is stored: no trailing slash, nothing after the path. */
			baseUrl: string;
			/** `local` means this machine or a private network; only allowed to main-site admins. */
			reach: Exclude<AddressReach, "blocked">;
			host: string;
			/** What the name led to when it was checked, for logs. The later connection looks again. */
			addresses: string[];
	  }
	| {
			ok: false;
			code: AddressRefusalCode;
			message: string;
			host: string | null;
			/** Set for a failed lookup, so the log keeps the real reason. */
			cause?: Error;
	  };

/** Names that reach the cloud host's own control service. Refused whatever they resolve to. */
const BLOCKED_HOSTNAMES = new Set([
	"metadata.google.internal",
	"metadata.goog",
	"instance-data",
	"instance-data.ec2.internal",
]);

const refuse = ({
	code,
	message,
	host = null,
	cause,
}: {
	code: AddressRefusalCode;
	message: string;
	host?: string | null;
	cause?: Error;
}): ServiceAddressCheck => ({ ok: false, code, message, host, ...(cause ? { cause } : {}) });

const readHost = (url: URL): string => url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.+$/, "");

const isLocalName = (host: string): boolean => host === "localhost" || host.endsWith(".localhost");

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

/** Finds where a host leads: a blocked name, a local name, an IP typed in, or whatever its DNS records say. */
const findHostReach = async ({
	host,
	resolveDns,
}: {
	host: string;
	resolveDns: ResolveDns;
}): Promise<{ reach: AddressReach; addresses: string[] } | { failure: Error }> => {
	if (BLOCKED_HOSTNAMES.has(host)) return { reach: "blocked", addresses: [] };
	if (isLocalName(host)) return { reach: "local", addresses: [] };
	if (isIP(host)) return { reach: classifyIp(host), addresses: [host] };

	const { err, result: addresses } = await safeTryAsync(() => resolveDns(host));
	if (err || !addresses) return { failure: err ?? new Error(`No addresses found for ${host}`) };
	if (addresses.length === 0) return { failure: new Error(`No addresses found for ${host}`) };
	return { reach: strictestReach(addresses.map(classifyIp)), addresses };
};

/**
 * Decides whether the server may call an address an admin typed in for the generic OpenAI-compatible choice.
 *
 * WHY it is its own checker: the server will call this address, so it can be used to reach machines the
 * admin could not reach themselves. The older WordPress-import check reads IPv4 only and lets a failed
 * lookup through; this one reads both families, fails closed, and handles addresses hidden inside IPv6.
 *
 * - http or https only, and no login in the address.
 * - A name is looked up and the strictest address it leads to decides (one private address makes it private).
 * - Metadata and link-local addresses are refused for everyone.
 * - Local and private addresses need `allowPrivate` (main-site admins). A public address must be https.
 */
export async function checkServiceAddress({
	input,
	allowPrivate,
	resolveDns,
}: {
	input: string;
	allowPrivate: boolean;
	resolveDns: ResolveDns;
}): Promise<ServiceAddressCheck> {
	const typed = input.trim();
	if (!URL.canParse(typed)) return refuse({ code: "invalid", message: AI_SETTINGS_MESSAGES.addressInvalid });
	const url = new URL(typed);

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return refuse({ code: "invalid", message: AI_SETTINGS_MESSAGES.addressInvalid });
	}
	const host = readHost(url);
	if (host === "") return refuse({ code: "invalid", message: AI_SETTINGS_MESSAGES.addressInvalid });
	if (url.username !== "" || url.password !== "") {
		return refuse({ code: "has_login", message: AI_SETTINGS_MESSAGES.addressHasLogin, host });
	}
	if (url.search !== "" || url.hash !== "") {
		return refuse({ code: "invalid", message: AI_SETTINGS_MESSAGES.addressInvalid, host });
	}

	const found = await findHostReach({ host, resolveDns });
	if ("failure" in found) {
		return refuse({ code: "lookup_failed", message: AI_SETTINGS_MESSAGES.addressLookupFailed, host, cause: found.failure });
	}
	if (found.reach === "blocked") {
		return refuse({ code: "not_allowed", message: AI_SETTINGS_MESSAGES.addressNotAllowed, host });
	}
	if (found.reach === "local" && !allowPrivate) {
		return refuse({ code: "not_public", message: AI_SETTINGS_MESSAGES.addressNotPublic, host });
	}
	if (found.reach === "public" && url.protocol !== "https:") {
		return refuse({ code: "needs_https", message: AI_SETTINGS_MESSAGES.addressNeedsHttps, host });
	}

	return {
		ok: true,
		baseUrl: `${url.origin}${stripTrailingSlashes(url.pathname)}`,
		reach: found.reach,
		host,
		addresses: found.addresses,
	};
}
