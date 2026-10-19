/**
 * What the Settings → AI screen and the server agree on. Nothing here ever carries the key itself:
 * the screen sends it once on save and afterwards only learns whether one is saved and how it ends.
 */

import type { BlockPatchOp, TreeChange } from "../page-tools/types";
import type { BlockConfig } from "../schema-types";

export const AI_PROVIDER_IDS = ["anthropic", "openai", "google", "openai-compatible"] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiProviderInfo = {
	id: AiProviderId;
	label: string;
	/** True when the admin types the service address (only the generic OpenAI-compatible choice). */
	needsAddress: boolean;
	/** Model names offered as hints. The field stays free text, because model lists change monthly. */
	modelSuggestions: readonly string[];
};

/** A one-click address for the generic choice. `isLocal` means only the main site's admins can use it. */
export type AiAddressPreset = {
	id: string;
	label: string;
	baseUrl: string;
	isLocal: boolean;
};

/** What a site admin sees of the saved settings. `keyEnding` is the last 4 characters of the key. */
export type AiSettingsView = {
	configured: true;
	provider: AiProviderId;
	model: string;
	baseUrl: string | null;
	/** False for a local service (Ollama, LM Studio) saved without a key. That is a normal state, not a fault. */
	hasKey: boolean;
	keyEnding: string | null;
	/** The server can no longer open the saved key (its sign-in secret changed). The admin enters it again. */
	keyUnreadable: boolean;
	updatedAt: string;
};

export type AiSettingsResponse = AiSettingsView | { configured: false };

/**
 * The save request. `apiKey` may be left out when a key is saved and the provider and address are unchanged,
 * or when the generic OpenAI-compatible choice points at a local address (then no key is stored).
 */
export type AiSaveInput = {
	siteId: string;
	provider: AiProviderId;
	model: string;
	baseUrl?: string;
	apiKey?: string;
};

/** What the editor asks before showing the assistant. */
export type AiStatus = {
	enabled: boolean;
	canManage: boolean;
};

export type AiSaveField = "provider" | "model" | "baseUrl" | "apiKey";

export type AiSaveErrorCode =
	| "not_allowed"
	| "rate_limited"
	| "invalid_request"
	| "key_needed"
	| "address_refused"
	| "not_ready"
	| "save_failed";

/** The body of a failed save. `field` tells the form which input to mark. */
export type AiSaveError = {
	message: string;
	code: AiSaveErrorCode;
	field: AiSaveField | null;
};

export type AiConnectionTestFailure = "not_configured" | "key_unreadable" | "not_available" | "unreachable" | "key_rejected" | "no_tool_use" | "failed";

/** Answer of "Test connection": a tiny call that must use a tool, so a model that can only chat is found out in Settings. */
export type AiConnectionTestResult = { ok: true } | { ok: false; code: AiConnectionTestFailure; message: string };

export type AiChatContentType = "page" | "post";

/** Ids one accepted change touched. The editor uses these for the "what changed" line and the highlight. */
export type AiPageChangeSummary = TreeChange["summary"];

/**
 * One accepted page change, streamed as a transient `data-page-change` UI part.
 * `blocks` is the whole working tree after the change. Nothing here is saved; Save stays the editor's job.
 */
export type AiPageChangeData = {
	ops: BlockPatchOp[];
	summary: AiPageChangeSummary;
	blocks: BlockConfig[];
};

/** Body of `POST /api/ai-builder/chat`. `messages` are AI SDK UI messages from the editor hook. */
export type AiChatRequest = {
	siteId: string;
	pageId: string;
	contentType: AiChatContentType;
	blocks: BlockConfig[];
	focusBlockId?: string;
	messages: Array<{
		id: string;
		role: "system" | "user" | "assistant";
		parts: Array<Record<string, string | number | boolean | null | object>>;
	}>;
};

export type AiChatErrorCode =
	| "not_allowed"
	| "page_missing"
	| "not_configured"
	| "key_unreadable"
	| "address_refused"
	| "already_running"
	| "hourly_limit"
	| "invalid_request"
	| "key_refused"
	| "unknown_model"
	| "busy_or_quota"
	| "no_answer"
	| "run_failed";

export type AiChatError = {
	message: string;
	code: AiChatErrorCode;
};
