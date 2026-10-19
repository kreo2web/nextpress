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
import { AI_ASSISTANT_LIMITS, type AiPageChangeData } from "@shared/ai-builder";
import type { SiteLookups, TreeChange } from "@shared/page-tools";
import type { BlockConfig } from "@shared/schema-types";
import { createAssistantTools } from "./assistant-tools";
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

	const explainFailure = (value: unknown): string => {
		const error = asError(value);
		const mapped = mapAiError(error);
		settle({ outcome: "failed", steps: 0, error });
		return mapped.message;
	};

	return createUIMessageStream({
		onError: explainFailure,
		execute: async ({ writer }) => {
			const { tools, toolApproval } = createAssistantTools({
				blocks,
				focusBlockId,
				site,
				onChange: (change) => writer.write({ type: PAGE_CHANGE_PART, data: toChangeData(change), transient: true }),
				onError: ({ tool, error }) =>
					console.error({ atFunction: "aiBuilder.runAssistant.tool", data: { ...ids, tool, error }, message: "A page tool step failed" }),
			});

			const chat = keepChatTurns(messages);
			const result = streamText({
				model,
				system: buildAssistantInstructions({ blocks, focusBlockId }),
				messages: await convertToModelMessages(chat, { tools, ignoreIncompleteToolCalls: true }),
				tools,
				toolApproval,
				stopWhen: isStepCount(AI_ASSISTANT_LIMITS.stepsPerRun),
				abortSignal: signal,
				onEnd: (event) => settle({ outcome: "finished", steps: event.steps.length, usage: event.usage }),
				onAbort: (event) => settle({ outcome: "stopped", steps: event.steps.length }),
			});

			writer.merge(toUIMessageStream({ stream: result.stream, tools, originalMessages: chat, onError: explainFailure }));
		},
	});
}
