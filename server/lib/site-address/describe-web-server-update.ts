import type { WebServerUpdate } from "../../utils/caddy";

/**
 * What a person needs to hear about the web server after an address change, in plain words.
 * Nothing when it simply worked, or when this install has no bundled web server (local development).
 */
export function describeWebServerUpdate(update: WebServerUpdate): string | null {
	if (update.status === "saved-for-restart") {
		return "Saved. The new address starts working after the web server restarts.";
	}
	if (update.status === "refused") {
		return "Saved, but the web server kept its previous setup, so this address isn't live yet. Check the address and save again.";
	}
	return null;
}
