import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { AI_ASSISTANT_MESSAGES, type AiConnectionTestFailure } from "@shared/ai-builder";
import type { Deps } from "../../routes/shared/deps";
import { safeTryAsync } from "../../utils";
import { canManageCoreUpdates } from "../core-update";
import type { TestAiConnection } from "./ai-settings-service";
import type { ResolveDns } from "./check-service-address";
import { createLanguageModel, type CreateLanguageModel } from "./create-model";
import { mapAiError, type MappedAiError } from "./map-ai-error";
import { recheckServiceAddress } from "./recheck-address";

/** Long enough for a cold local model to load, short enough that the Settings button doesn't hang. */
const TEST_TIMEOUT_MS = 30_000;

const FAILURE_CODE: Record<MappedAiError["code"], AiConnectionTestFailure> = {
	key_refused: "key_rejected",
	no_tool_use: "no_tool_use",
	unknown_model: "failed",
	busy_or_quota: "failed",
	no_answer: "unreachable",
	run_failed: "failed",
};

const sayOk = tool({
	description: "Confirms the connection works. Call it once with no input.",
	inputSchema: z.object({}),
	execute: async () => "ok",
});

/**
 * "Test connection": one tiny call that must use a tool. A model that can chat but not use tools
 * can't build pages, so it is found out here rather than in the editor. Uses the same address
 * re-check and pinned connection as a real run.
 */
export const createConnectionTester = ({
	models,
	resolveDns,
	createModel = createLanguageModel,
}: {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	resolveDns: ResolveDns;
	createModel?: CreateLanguageModel;
}): TestAiConnection => {
	return async (settings) => {
		const allowPrivate = await canManageCoreUpdates({ models, userId: settings.updatedBy });
		const address = await recheckServiceAddress({ settings, allowPrivate, resolveDns });
		if (!address.ok) return { ok: false, code: "unreachable", message: address.message };

		const { err, result } = await safeTryAsync(() =>
			generateText({
				model: createModel({ settings, fetch: address.fetch }),
				prompt: "Call the say_ok tool once.",
				tools: { say_ok: sayOk },
				toolChoice: "required",
				stopWhen: isStepCount(1),
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
			}).finally(() => address.close()),
		);

		if (err || !result) {
			const error = err instanceof Error ? err : new Error(String(err));
			const mapped = mapAiError(error);
			console.warn({
				atFunction: "aiBuilder.testConnection",
				data: { provider: settings.provider, model: settings.model, host: address.host, code: mapped.code, error },
				message: "AI connection test failed",
			});
			return { ok: false, code: FAILURE_CODE[mapped.code], message: mapped.message };
		}
		if (result.toolCalls.length === 0) {
			console.warn({
				atFunction: "aiBuilder.testConnection",
				data: { provider: settings.provider, model: settings.model, host: address.host, finishReason: result.finishReason },
				message: "AI connection test: the model answered without using the tool",
			});
			return { ok: false, code: "no_tool_use", message: AI_ASSISTANT_MESSAGES.noToolUse };
		}
		return { ok: true };
	};
};
