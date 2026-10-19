import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { AiSettingsForUse } from "./ai-settings-service";
import type { ProviderFetch } from "./pinned-fetch";

export type CreateLanguageModel = (params: {
	settings: AiSettingsForUse;
	fetch: ProviderFetch;
}) => LanguageModel;

const keyOrNone = (apiKey: string): string | undefined => (apiKey.trim() === "" ? undefined : apiKey);

/**
 * Builds the AI SDK model for a site's saved settings. `fetch` is already pinned (or
 * refuses redirects) so this function never looks a name up itself.
 */
export const createLanguageModel: CreateLanguageModel = ({ settings, fetch }) => {
	const { provider, model, apiKey, baseUrl } = settings;
	const key = keyOrNone(apiKey);

	if (provider === "anthropic") {
		return createAnthropic({ apiKey: key, fetch })(model);
	}
	if (provider === "openai") {
		return createOpenAI({ apiKey: key, fetch })(model);
	}
	if (provider === "google") {
		return createGoogleGenerativeAI({ apiKey: key, fetch })(model);
	}

	if (!baseUrl) {
		throw new Error("openai-compatible settings are missing an address");
	}
	return createOpenAICompatible({
		name: "site-ai",
		baseURL: baseUrl,
		apiKey: key,
		fetch,
	})(model);
};
