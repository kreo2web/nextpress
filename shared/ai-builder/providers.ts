import type { AiAddressPreset, AiProviderId, AiProviderInfo } from "./types";

/**
 * Only Anthropic's names are listed: they are known. The others stay empty on purpose, because a guessed
 * model name that has since been retired sends admins to an error they can't diagnose.
 */
export const AI_PROVIDERS: readonly AiProviderInfo[] = [
	{
		id: "anthropic",
		label: "Anthropic (Claude)",
		needsAddress: false,
		modelSuggestions: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
	},
	{ id: "openai", label: "OpenAI", needsAddress: false, modelSuggestions: [] },
	{ id: "google", label: "Google (Gemini)", needsAddress: false, modelSuggestions: [] },
	{
		id: "openai-compatible",
		label: "Any OpenAI-compatible service",
		needsAddress: true,
		modelSuggestions: [],
	},
];

/** Starting points for the generic choice: OpenRouter, Groq, DeepSeek and others only need their own address. */
export const AI_ADDRESS_PRESETS: readonly AiAddressPreset[] = [
	{ id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", isLocal: false },
	{ id: "ollama", label: "Ollama on this server", baseUrl: "http://localhost:11434/v1", isLocal: true },
	{ id: "lm-studio", label: "LM Studio on this server", baseUrl: "http://localhost:1234/v1", isLocal: true },
];

export const isAiProviderId = (value: string): value is AiProviderId =>
	AI_PROVIDERS.some((provider) => provider.id === value);

export const getAiProvider = (id: AiProviderId): AiProviderInfo => {
	const provider = AI_PROVIDERS.find((entry) => entry.id === id);
	if (!provider) throw new Error(`Unknown AI provider: ${id}`);
	return provider;
};
