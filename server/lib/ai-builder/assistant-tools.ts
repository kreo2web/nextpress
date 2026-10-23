import { isToolUIPart, tool, type ToolSet, type UIMessage } from "ai";
import { z } from "zod";
import { AI_ASSISTANT_LIMITS } from "@shared/ai-builder";
import { createPageTools, type PageTool, type PageToolContext, type SiteLookups, type ToolErrorReport, type TreeChange } from "@shared/page-tools";
import { countBlocks, findBlockById } from "@shared/page-tools/tree-find";
import type { BlockConfig } from "@shared/schema-types";

/** The page tool that can remove blocks, and so the only one that may need the person's OK. */
const CHANGE_TOOL = "change_blocks";

type RemovingOp = { op: string; id?: string };

const REMOVAL_DECLINED_TEXT =
	"Nothing was changed. The person said no to removing blocks in this request, so remove nothing now, not even part of it or its parent. Tell them what you left in place.";

/** Returns why a call is refused before it runs, or null to run it. */
type RefuseCall = (params: { name: string; input: Record<string, unknown> }) => string | null;

const toSdkTools = ({ pageTools, refuse }: { pageTools: PageTool[]; refuse: RefuseCall }): ToolSet =>
	Object.fromEntries(
		pageTools.map((pageTool) => [
			pageTool.name,
			tool({
				description: pageTool.description,
				inputSchema: z.object(pageTool.inputShape),
				execute: async (input: Record<string, unknown>) => refuse({ name: pageTool.name, input }) ?? (await pageTool.run(input)).text,
			}),
		]),
	);

/**
 * True when the person said no to a removal in the request this run continues (the last
 * assistant turn). A new message from them starts over, so they can still change their mind.
 */
export const wasRemovalDeclined = (messages: UIMessage[]): boolean => {
	const last = messages.at(-1);
	return last?.role === "assistant" && last.parts.some((part) => isToolUIPart(part) && part.approval?.approved === false);
};

const readOps = (input: Record<string, unknown>): RemovingOp[] =>
	Array.isArray(input.ops) ? input.ops.filter((op): op is RemovingOp => typeof op === "object" && op !== null && "op" in op) : [];

/** Blocks a change would take off the page: each deleted or replaced block with everything inside it. */
export const countRemovedBlocks = ({ tree, input }: { tree: BlockConfig[]; input: Record<string, unknown> }): number =>
	readOps(input)
		.filter((op) => (op.op === "delete" || op.op === "replace") && typeof op.id === "string")
		.reduce((total, op) => {
			const block = findBlockById({ blocks: tree, id: op.id ?? "" });
			return total + (block ? countBlocks([block]) : 0);
		}, 0);

export type AssistantTools = {
	tools: ToolSet;
	/** For `streamText({ toolApproval })`: a big removal waits for the person to confirm in the editor. */
	toolApproval: Record<string, (input: Record<string, unknown>) => "user-approval" | "not-applicable">;
	readTree: () => BlockConfig[];
};

/**
 * Page tools over an in-memory working copy of the tree the editor posted. Nothing is saved:
 * each accepted change replaces the copy and goes to `onChange`, which streams it to the editor.
 * Once the person has said no to a removal in this request, every later removal is refused
 * without asking again: a model that looks for another way round the "no" gets nowhere.
 */
export const createAssistantTools = ({
	blocks,
	focusBlockId,
	site,
	removalDeclined = false,
	onChange,
	onError,
}: {
	blocks: BlockConfig[];
	focusBlockId?: string | null;
	site?: SiteLookups;
	removalDeclined?: boolean;
	onChange: (change: TreeChange) => void;
	onError: (report: ToolErrorReport) => void;
}): AssistantTools => {
	let tree = structuredClone(blocks);

	const ctx: PageToolContext = {
		readTree: async () => structuredClone(tree),
		writeTree: async (change) => {
			tree = structuredClone(change.blocks);
			onChange(change);
			return { ok: true };
		},
		focusBlockId,
		newId: () => crypto.randomUUID(),
		site,
		onError,
	};

	const removes = (input: Record<string, unknown>): number => countRemovedBlocks({ tree, input });
	const refuse: RefuseCall = ({ name, input }) =>
		removalDeclined && name === CHANGE_TOOL && removes(input) > 0 ? REMOVAL_DECLINED_TEXT : null;

	return {
		tools: toSdkTools({ pageTools: createPageTools(ctx), refuse }),
		toolApproval: {
			[CHANGE_TOOL]: (input) =>
				!removalDeclined && removes(input) > AI_ASSISTANT_LIMITS.confirmRemovalsOver ? "user-approval" : "not-applicable",
		},
		readTree: () => tree,
	};
};
