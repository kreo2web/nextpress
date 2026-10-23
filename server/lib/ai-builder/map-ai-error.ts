import {
	APICallError,
	InvalidToolInputError,
	LoadAPIKeyError,
	NoSuchModelError,
	ToolChoiceViolationError,
} from "ai";
import { AI_ASSISTANT_MESSAGES } from "@shared/ai-builder";

export type MappedAiError = {
	message: string;
	code: "key_refused" | "unknown_model" | "busy_or_quota" | "no_answer" | "no_tool_use" | "run_failed";
};

const statusOf = (error: Error): number | undefined =>
	error instanceof APICallError ? error.statusCode : undefined;

const looksLikeKeyRefusal = (error: Error): boolean => {
	if (error instanceof LoadAPIKeyError) return true;
	const status = statusOf(error);
	if (status === 401 || status === 403) return true;
	const text = error.message.toLowerCase();
	return text.includes("invalid api key") || text.includes("incorrect api key") || text.includes("authentication");
};

const looksLikeUnknownModel = (error: Error): boolean => {
	if (error instanceof NoSuchModelError) return true;
	const status = statusOf(error);
	if (status === 404) return true;
	const text = error.message.toLowerCase();
	return text.includes("model") && (text.includes("not found") || text.includes("does not exist") || text.includes("unknown"));
};

/** Local services (Ollama, LM Studio) answer a tool call to a chat-only model with a plain 400. */
const looksLikeNoToolSupport = (error: Error): boolean => {
	const text = error.message.toLowerCase();
	return text.includes("tool") && (text.includes("not support") || text.includes("unsupported"));
};

const looksLikeBusy = (error: Error): boolean => {
	const status = statusOf(error);
	if (status === 429 || status === 402 || status === 503) return true;
	if (error instanceof APICallError && error.isRetryable) return true;
	const text = error.message.toLowerCase();
	return text.includes("rate limit") || text.includes("quota") || text.includes("capacity") || text.includes("overloaded");
};

/**
 * Turns a model/provider failure into a short next-step message. The log keeps the real cause.
 * Never include the key or the prompt in either side.
 */
export const mapAiError = (error: Error): MappedAiError => {
	if (error instanceof ToolChoiceViolationError || looksLikeNoToolSupport(error)) {
		return { message: AI_ASSISTANT_MESSAGES.noToolUse, code: "no_tool_use" };
	}
	if (error instanceof InvalidToolInputError) {
		return { message: AI_ASSISTANT_MESSAGES.malformedToolInput, code: "run_failed" };
	}
	if (looksLikeKeyRefusal(error)) {
		return { message: AI_ASSISTANT_MESSAGES.keyRefused, code: "key_refused" };
	}
	if (looksLikeUnknownModel(error)) {
		return { message: AI_ASSISTANT_MESSAGES.unknownModel, code: "unknown_model" };
	}
	if (looksLikeBusy(error)) {
		return { message: AI_ASSISTANT_MESSAGES.busyOrQuota, code: "busy_or_quota" };
	}
	return { message: AI_ASSISTANT_MESSAGES.noAnswer, code: "no_answer" };
};

export const httpStatusForMapped = (code: MappedAiError["code"]): number => {
	if (code === "key_refused") return 401;
	if (code === "unknown_model") return 400;
	if (code === "busy_or_quota") return 429;
	if (code === "no_tool_use") return 400;
	return 502;
};
