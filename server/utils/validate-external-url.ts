import { normalizeSiteUrl } from "@shared/import/wordpress/normalize-site-url";
import { checkPublicAddress } from "./safe-public-fetch";

/**
 * Checks an address someone typed (a WordPress site, a remote image) before the server fetches it:
 * http(s) only, and every IPv4 and IPv6 address it leads to on the open internet. A failed lookup
 * refuses. Gives people an early, plain answer; the fetch itself (`createSafePublicFetch`) checks
 * again on every hop, so this is never the only guard.
 */
export const validateExternalUrl = async (
	input: string,
): Promise<{ ok: true; url: URL } | { ok: false; message: string }> => {
	const baseUrl = normalizeSiteUrl(input);
	if (!baseUrl) return { ok: false, message: "That address isn't valid." };

	const check = await checkPublicAddress({ input: baseUrl });
	if (!check.ok) {
		console.warn({ atFunction: "validateExternalUrl", data: { input, error: check.cause }, message: `Address refused: ${check.message}` });
		return { ok: false, message: check.message };
	}
	return { ok: true, url: check.url };
};
