import {
	AI_SETTINGS_MESSAGES,
	getAiProvider,
	type AiConnectionTestResult,
	type AiProviderId,
	type AiSaveErrorCode,
	type AiSaveField,
	type AiSaveInput,
	type AiSettingsResponse,
} from "@shared/ai-builder";
import { isBuiltInAuthSecret } from "../../config";
import type { Deps } from "../../routes/shared/deps";
import { safeTryAsync } from "../../utils";
import { checkServiceAddress, type ResolveDns } from "./check-service-address";
import { AI_BUILDER_OPTION_NAME } from "./reserved-option-names";
import { openSecret, sealSecret, type SealedSecret } from "./secret-box";
import { parseStoredSettings, toSettingsView, type StoredAiSettings } from "./stored-settings";

/** The address a save settled on (`undefined` for the built-in providers) and whether it is a local one. */
type AddressDecision = { address: string | undefined; reach: "public" | "local" | null };

/** The fields a save carries; the site comes separately. */
export type AiSaveValues = Omit<AiSaveInput, "siteId">;

export type SaveAiSettingsResult =
	| { ok: true; view: Extract<AiSettingsResponse, { configured: true }> }
	| { ok: false; code: AiSaveErrorCode; message: string; field: AiSaveField | null };

/** Everything the assistant needs to call the model. The key is in the clear, so this never leaves the server. */
export type AiSettingsForUse = {
	provider: AiProviderId;
	model: string;
	baseUrl: string | null;
	/** Empty when a local service (Ollama, LM Studio) was saved without a key. */
	apiKey: string;
	/** Who saved it. A saved private address is only trusted while this person is still a main-site admin. */
	updatedBy: string;
};

export type LoadAiSettingsResult =
	| { ok: true; settings: AiSettingsForUse }
	| { ok: false; reason: "not_configured" | "key_unreadable" };

/** Makes one tiny call that must use a tool. Supplied once the AI library is installed; nothing calls it yet. */
export type TestAiConnection = (settings: AiSettingsForUse) => Promise<AiConnectionTestResult>;

export type AiSettingsService = {
	/** What a site admin sees: provider, model, address and whether a readable key is saved. Never the key. */
	getView: (params: { siteId: string }) => Promise<AiSettingsResponse>;
	/** True when the site has settings and the server can open the saved key: the editor shows the assistant. */
	isEnabled: (params: { siteId: string }) => Promise<boolean>;
	/**
	 * Saves a site's settings after the caller has checked who is asking. `canUsePrivateAddress` is the
	 * main-site-admin bar for local and private addresses.
	 */
	save: (params: {
		siteId: string;
		userId: string;
		values: AiSaveValues;
		canUsePrivateAddress: boolean;
	}) => Promise<SaveAiSettingsResult>;
	remove: (params: { siteId: string; userId: string }) => Promise<{ removed: boolean }>;
	/** For the assistant route: the settings with the key opened, or why they can't be used. */
	loadForUse: (params: { siteId: string }) => Promise<LoadAiSettingsResult>;
	/** The seam for "Test connection". Needs the `testConnection` dependency; until then it says it isn't available. */
	testConnection: (params: { siteId: string }) => Promise<AiConnectionTestResult>;
};

type KeyDecision =
	| { ok: true; key: SealedSecret | null; keyEnding: string | null }
	| { ok: false; code: AiSaveErrorCode; message: string; field: AiSaveField };

const fail = ({
	code,
	message,
	field = null,
}: {
	code: AiSaveErrorCode;
	message: string;
	field?: AiSaveField | null;
}): SaveAiSettingsResult => ({ ok: false, code, message, field });

/**
 * A site's AI settings: where they are kept, how the key is locked, and the rules for saving them.
 * The clock, the secret, the DNS lookup and the connection test are injected, so tests need no network.
 */
export function createAiSettingsService({
	models,
	getSecret,
	isProduction,
	resolveDns,
	now,
	testConnection,
}: {
	models: Pick<Deps["models"], "options">;
	getSecret: () => string;
	isProduction: boolean;
	resolveDns: ResolveDns;
	now: () => Date;
	testConnection?: TestAiConnection;
}): AiSettingsService {
	const readStored = async (siteId: string): Promise<StoredAiSettings | null> => {
		const row = await models.options.getOption(AI_BUILDER_OPTION_NAME, siteId);
		if (!row) return null;
		const parsed = await parseStoredSettings(row.value);
		if (!parsed.ok) {
			console.error({
				atFunction: "aiSettings.read",
				data: { siteId, error: parsed.cause },
				message: "Saved AI settings could not be read, so the site is treated as having none",
			});
			return null;
		}
		return parsed.stored;
	};

	/**
	 * Which key to store. A key typed now always wins. A blank box keeps the saved key when the provider and
	 * address are unchanged. Otherwise a blank box is fine only for a local service, which stores "no key".
	 */
	const decideKey = ({
		values,
		address,
		existing,
		passphrase,
		context,
	}: {
		values: AiSaveValues;
		address: AddressDecision;
		existing: StoredAiSettings | null;
		passphrase: string;
		context: { siteId: string; userId: string };
	}): KeyDecision => {
		const newKey = values.apiKey?.trim();
		if (newKey) {
			return { ok: true, key: sealSecret({ secret: newKey, passphrase }), keyEnding: newKey.slice(-4) };
		}

		const needKey = (message: string): KeyDecision => ({ ok: false, code: "key_needed", message, field: "apiKey" });
		const sameService = existing?.provider === values.provider && existing.baseUrl === address.address;

		if (existing?.key && sameService) {
			const opened = openSecret({ sealed: existing.key, passphrase });
			if (opened.ok) return { ok: true, key: existing.key, keyEnding: existing.keyEnding };
			console.warn({
				atFunction: "aiSettings.save",
				data: { ...context, provider: values.provider, error: opened.cause },
				message: "Saved key can't be opened, so a new one is needed",
			});
			return needKey(AI_SETTINGS_MESSAGES.keyUnreadable);
		}
		if (address.reach === "local") return { ok: true, key: null, keyEnding: null };
		if (existing && !sameService) return needKey(AI_SETTINGS_MESSAGES.keyNeededAfterChange);
		return needKey(AI_SETTINGS_MESSAGES.keyNeeded);
	};

	const checkAddress = async ({
		values,
		canUsePrivateAddress,
		context,
	}: {
		values: AiSaveValues;
		canUsePrivateAddress: boolean;
		context: { siteId: string; userId: string };
	}): Promise<({ ok: true } & AddressDecision) | Extract<SaveAiSettingsResult, { ok: false }>> => {
		const typed = values.baseUrl?.trim() ?? "";
		if (!getAiProvider(values.provider).needsAddress) {
			if (typed === "") return { ok: true, address: undefined, reach: null };
			return { ok: false, code: "invalid_request", message: AI_SETTINGS_MESSAGES.addressNotUsed, field: "baseUrl" };
		}
		if (typed === "") {
			return { ok: false, code: "invalid_request", message: AI_SETTINGS_MESSAGES.addressNeeded, field: "baseUrl" };
		}

		const check = await checkServiceAddress({ input: typed, allowPrivate: canUsePrivateAddress, resolveDns });
		if (check.ok) return { ok: true, address: check.baseUrl, reach: check.reach };

		console.warn({
			atFunction: "aiSettings.save",
			data: { ...context, provider: values.provider, host: check.host, code: check.code, error: check.cause },
			message: "AI service address refused",
		});
		return { ok: false, code: "address_refused", message: check.message, field: "baseUrl" };
	};

	const save: AiSettingsService["save"] = async ({ siteId, userId, values, canUsePrivateAddress }) => {
		const context = { siteId, userId };
		const passphrase = getSecret();
		if (isProduction && isBuiltInAuthSecret(passphrase)) {
			console.error({
				atFunction: "aiSettings.save",
				data: { ...context, provider: values.provider },
				message: "Refused to save an AI key: the server is in production on the built-in sign-in secret",
			});
			return fail({ code: "not_ready", message: AI_SETTINGS_MESSAGES.notReady });
		}

		const address = await checkAddress({ values, canUsePrivateAddress, context });
		if (!address.ok) return address;

		const existing = await readStored(siteId);
		const key = decideKey({ values, address, existing, passphrase, context });
		if (!key.ok) return key;

		const stored: StoredAiSettings = {
			provider: values.provider,
			model: values.model.trim(),
			...(address.address ? { baseUrl: address.address } : {}),
			key: key.key,
			keyEnding: key.keyEnding,
			updatedAt: now().toISOString(),
			updatedBy: userId,
		};
		await models.options.setOption({ name: AI_BUILDER_OPTION_NAME, value: JSON.stringify(stored), siteId });

		console.info({
			atFunction: "aiSettings.save",
			data: { ...context, provider: stored.provider, model: stored.model, baseUrl: stored.baseUrl ?? null, hasKey: key.key !== null, keyChanged: key.key !== (existing?.key ?? null) },
			message: "AI settings saved",
		});
		return { ok: true, view: toSettingsView({ stored, passphrase }) };
	};

	const loadForUse: AiSettingsService["loadForUse"] = async ({ siteId }) => {
		const stored = await readStored(siteId);
		if (!stored) return { ok: false, reason: "not_configured" };
		const settings = { provider: stored.provider, model: stored.model, baseUrl: stored.baseUrl ?? null, updatedBy: stored.updatedBy };
		if (stored.key === null) return { ok: true, settings: { ...settings, apiKey: "" } };

		const opened = openSecret({ sealed: stored.key, passphrase: getSecret() });
		if (!opened.ok) {
			console.warn({
				atFunction: "aiSettings.loadForUse",
				data: { siteId, provider: stored.provider, error: opened.cause },
				message: "Saved key can't be opened",
			});
			return { ok: false, reason: "key_unreadable" };
		}
		return { ok: true, settings: { ...settings, apiKey: opened.secret } };
	};

	return {
		getView: async ({ siteId }) => {
			const stored = await readStored(siteId);
			return stored ? toSettingsView({ stored, passphrase: getSecret() }) : { configured: false };
		},

		isEnabled: async ({ siteId }) => {
			const stored = await readStored(siteId);
			return stored ? !toSettingsView({ stored, passphrase: getSecret() }).keyUnreadable : false;
		},

		save,
		loadForUse,

		remove: async ({ siteId, userId }) => {
			const row = await models.options.getOption(AI_BUILDER_OPTION_NAME, siteId);
			if (!row) return { removed: false };
			await models.options.delete(row.id);
			console.info({ atFunction: "aiSettings.remove", data: { siteId, userId }, message: "AI settings removed" });
			return { removed: true };
		},

		testConnection: async ({ siteId }) => {
			const loaded = await loadForUse({ siteId });
			if (!loaded.ok) {
				const message = loaded.reason === "key_unreadable" ? AI_SETTINGS_MESSAGES.keyUnreadable : AI_SETTINGS_MESSAGES.testNotConfigured;
				return { ok: false, code: loaded.reason, message };
			}
			if (!testConnection) {
				return { ok: false, code: "not_available", message: AI_SETTINGS_MESSAGES.testNotAvailable };
			}
			const { err, result } = await safeTryAsync(() => testConnection(loaded.settings));
			if (err || !result) {
				console.error({
					atFunction: "aiSettings.testConnection",
					data: { siteId, provider: loaded.settings.provider, error: err },
					message: "Connection test could not run",
				});
				return { ok: false, code: "failed", message: AI_SETTINGS_MESSAGES.testFailed };
			}
			return result;
		},
	};
}
