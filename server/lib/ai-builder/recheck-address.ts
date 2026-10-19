import { AI_SETTINGS_MESSAGES, getAiProvider } from "@shared/ai-builder";
import { checkServiceAddress, type ResolveDns, type ServiceAddressCheck } from "./check-service-address";
import type { AiSettingsForUse } from "./ai-settings-service";
import {
	createPinnedFetch,
	createRefuseRedirectsFetch,
	type PinnedFetch,
	type ProviderFetch,
} from "./pinned-fetch";

export type AddressRecheck =
	| { ok: true; fetch: ProviderFetch; close: () => Promise<void>; reach: "public" | "local" | null; host: string | null }
	| { ok: false; message: string; host: string | null };

const ready = ({
	fetch,
	close,
	reach,
	host,
}: {
	fetch: ProviderFetch;
	close: () => Promise<void>;
	reach: "public" | "local" | null;
	host: string | null;
}): AddressRecheck => ({ ok: true, fetch, close, reach, host });

const fromPinned = (pinned: PinnedFetch, check: Extract<ServiceAddressCheck, { ok: true }>): AddressRecheck =>
	ready({ fetch: pinned.fetch, close: pinned.close, reach: check.reach, host: check.host });

/**
 * Resolves the stored address again and builds the fetch for this run.
 *
 * `allowPrivate` is true only while the person who saved the settings is still a
 * main-site admin: they chose the address, so their right to choose a local one is what
 * counts, not the right of whoever is chatting. Built-in providers skip the lookup and
 * only refuse redirects.
 */
export async function recheckServiceAddress({
	settings,
	allowPrivate,
	resolveDns,
}: {
	settings: AiSettingsForUse;
	allowPrivate: boolean;
	resolveDns: ResolveDns;
}): Promise<AddressRecheck> {
	if (!getAiProvider(settings.provider).needsAddress) {
		return ready({ fetch: createRefuseRedirectsFetch(), close: async () => undefined, reach: null, host: null });
	}

	const input = settings.baseUrl?.trim() ?? "";
	if (input === "") {
		return { ok: false, message: AI_SETTINGS_MESSAGES.addressNeeded, host: null };
	}

	const check = await checkServiceAddress({ input, allowPrivate, resolveDns });
	if (!check.ok) {
		console.warn({
			atFunction: "aiBuilder.recheckAddress",
			data: { provider: settings.provider, host: check.host, code: check.code, error: check.cause },
			message: "AI service address refused on re-check",
		});
		return { ok: false, message: check.message, host: check.host };
	}

	return fromPinned(createPinnedFetch({ host: check.host, addresses: check.addresses }), check);
}
