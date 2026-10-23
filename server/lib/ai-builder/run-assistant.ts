import {
	convertToModelMessages,
	createUIMessageStream,
	isStepCount,
	streamText,
	toUIMessageStream,
	type LanguageModel,
	type LanguageModelUsage,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { AI_ASSISTANT_LIMITS, AI_ASSISTANT_MESSAGES, type AiPageChangeData } from "@shared/ai-builder";
import { repairChangeBlocksInput, type SiteLookups, type TreeChange } from "@shared/page-tools";
import type { BlockConfig } from "@shared/schema-types";
import { createAssistantTools, wasRemovalDeclined } from "./assistant-tools";
import { buildAssistantInstructions } from "./build-instructions";
import { mapAiError } from "./map-ai-error";

/** The name of the streamed part the editor listens for. */
export const PAGE_CHANGE_PART = "data-page-change";

export type AssistantRunIds = { userId: string; siteId: string; pageId: string };

export type RunAssistantParams = {
	model: LanguageModel;
	/** For the finish log only. */
	provider: string;
	modelName: string;
	blocks: BlockConfig[];
	focusBlockId?: string;
	messages: UIMessage[];
	site?: SiteLookups;
	signal: AbortSignal;
	ids: AssistantRunIds;
	/** Called once, however the run ends: finished, stopped or failed. */
	onSettled: () => void;
	now?: () => number;
};

const toChangeData = ({ ops, summary, blocks }: TreeChange): AiPageChangeData => ({ ops, summary, blocks });

const asError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

/** Only what the person typed and what the assistant said before; a `system` turn from the browser is dropped. */
const keepChatTurns = (messages: UIMessage[]): UIMessage[] =>
	messages.filter((message) => message.role !== "system").slice(-AI_ASSISTANT_LIMITS.maxMessages);

/**
 * One assistant run as a UI message stream: the model works on a copy of the editor's tree through
 * the page tools, and every accepted change is streamed as a transient `data-page-change` part
 * (so the whole tree never goes back into the chat history). Nothing is saved here.
 *
 * Logged on every ending: ids, provider, model, steps, tokens and duration. Never the key or the prompt.
 */
export function createAssistantStream({
	model,
	provider,
	modelName,
	blocks,
	focusBlockId,
	messages,
	site,
	signal,
	ids,
	onSettled,
	now = () => Date.now(),
}: RunAssistantParams): ReadableStream<UIMessageChunk> {
	const startedAt = now();
	let settled = false;

	const settle = ({
		outcome,
		steps,
		usage,
		error,
	}: {
		outcome: "finished" | "stopped" | "failed";
		steps: number;
		usage?: LanguageModelUsage;
		error?: Error;
	}): void => {
		if (settled) return;
		settled = true;
		const data = {
			...ids,
			provider,
			model: modelName,
			outcome,
			steps,
			inputTokens: usage?.inputTokens ?? null,
			outputTokens: usage?.outputTokens ?? null,
			ms: now() - startedAt,
			...(error ? { error } : {}),
		};
		const log = { atFunction: "aiBuilder.runAssistant", data, message: `Assistant run ${outcome}` };
		if (outcome === "failed") console.error(log);
		else console.info(log);
		onSettled();
	};

	/**
	 * Words for a failed step or run, with no side effects: the library asks for them on every tool
	 * step that fails, and the model simply tries that step again. A step the model sent in an
	 * unreadable shape arrives as the library's own message string.
	 */
	const describeFailure = (value: unknown): string =>
		typeof value === "string" ? AI_ASSISTANT_MESSAGES.malformedToolInput : mapAiError(asError(value)).message;

	/** Only a failure of the whole run ends it; that frees the person's slot and the connection. */
	const endWithFailure = (value: unknown): string => {
		settle({ outcome: "failed", steps: 0, error: asError(value) });
		return describeFailure(value);
	};

	return createUIMessageStream({
		onError: endWithFailure,
		execute: async ({ writer }) => {
			const chat = keepChatTurns(messages);
			const { tools, toolApproval } = createAssistantTools({
				blocks,
				focusBlockId,
				site,
				removalDeclined: wasRemovalDeclined(chat),
				onChange: (change) => writer.write({ type: PAGE_CHANGE_PART, data: toChangeData(change), transient: true }),
				onError: ({ tool, error }) =>
					console.error({ atFunction: "aiBuilder.runAssistant.tool", data: { ...ids, tool, error }, message: "A page tool step failed" }),
			});

			const result = streamText({
				model,
				system: buildAssistantInstructions({ blocks, focusBlockId }),
				messages: await convertToModelMessages(chat, { tools, ignoreIncompleteToolCalls: true }),
				tools,
				toolApproval,
				stopWhen: isStepCount(AI_ASSISTANT_LIMITS.stepsPerRun),
				abortSignal: signal,
				// Smaller models sometimes send the page changes in a slightly wrong shape. Fix what can
				// be fixed; anything else keeps the SDK's normal "invalid input" failure.
				repairToolCall: async ({ toolCall, error }) => {
					const input = toolCall.toolName === "change_blocks" ? await repairChangeBlocksInput(toolCall.input) : null;
					if (input !== null) return { ...toolCall, input };
					console.warn({
						atFunction: "aiBuilder.runAssistant.repairToolCall",
						data: { ...ids, tool: toolCall.toolName, error },
						message: "The model sent tool input that could not be repaired; it will be asked to try again",
					});
					return null;
				},
				onError: ({ error }) => {
					endWithFailure(error);
				},
				onEnd: (event) => settle({ outcome: "finished", steps: event.steps.length, usage: event.usage }),
				onAbort: (event) => settle({ outcome: "stopped", steps: event.steps.length }),
			});

			writer.merge(toUIMessageStream({ stream: result.stream, tools, originalMessages: chat, onError: describeFailure }));
		},
	});
}
