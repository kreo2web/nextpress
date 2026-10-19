import { createPageTools, type PageTool, type PageToolResult } from "@nextpress-org/sdk";
import { z } from "zod";
import { runTool, type McpTextResult } from "../format-result.js";
import { toMcpText } from "./mcp-tool-text.js";
import { createEntityContext, createNoPageContext } from "./page-tool-context.js";
import { createKeyedQueue, type KeyedQueue } from "./run-in-order.js";
import type { ToolDeps } from "./tool-deps.js";

/** The two inputs every page-scoped tool takes on top of the shared tool's own. */
const pageScopeShape = {
	id: z
		.string()
		.min(1)
		.describe('Which page: its UUID or slug. For a blog post, the post UUID, with content_type "post".'),
	content_type: z
		.enum(["page", "post"])
		.default("page")
		.describe('"page" (default) or "post" for a blog post. Posts have blocks too.'),
};
const pageScopeSchema = z.object(pageScopeShape);

type InputRename = { shared: string; mcp: string };

/** A shared page tool that MCP offers on a saved page or post, under a page-scoped name. */
type PageScopedTool = {
	sharedName: string;
	name: string;
	/** Said before the shared description, when the MCP version differs from what that text assumes. */
	leadNote?: string;
	/** Said after the shared description: what only the MCP version needs to know. */
	note?: string;
	/** Inputs the shared tool names like the page's own `id`; MCP sends them under another name. */
	renames?: InputRename[];
};

const SCOPE_NOTE =
	'Works on one saved page, or on a blog post when content_type is "post". Name it in "id".';

const PAGE_SCOPED_TOOLS: PageScopedTool[] = [
	{ sharedName: "get_page_outline", name: "get_page_outline" },
	{
		sharedName: "get_block",
		name: "get_page_block",
		leadNote: 'Here "id" is the page and "block_id" is the block.',
		renames: [{ shared: "id", mcp: "block_id" }],
	},
	{
		sharedName: "change_blocks",
		name: "change_page_blocks",
		note: "It saves with the page version it just read. If the page was saved somewhere else in the meantime, nothing is changed and you are told to read the outline again.",
	},
	{ sharedName: "check_page", name: "check_page" },
	{ sharedName: "apply_phone_fixes", name: "apply_page_phone_fixes" },
];

/** Tools that need no page: block types and the design guide. Registered under their shared names. */
const SITE_LEVEL_TOOLS = ["list_block_types", "get_block_type", "get_design_guide"];

const requireTool = ({ tools, name }: { tools: PageTool[]; name: string }): PageTool => {
	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) {
		throw new Error(
			`The shared page tools have no tool named ${name}. The MCP server and the SDK are out of step.`,
		);
	}
	return tool;
};

const toTextResult = ({ ok, text }: PageToolResult): McpTextResult => ({
	content: [{ type: "text", text: toMcpText(text) }],
	...(ok ? {} : { isError: true }),
});

const toMcpInputShape = ({ tool, renames = [] }: { tool: PageTool; renames?: InputRename[] }) => ({
	...pageScopeShape,
	...Object.fromEntries(
		Object.entries(tool.inputShape).map(([key, schema]) => [
			renames.find((rename) => rename.shared === key)?.mcp ?? key,
			schema,
		]),
	),
});

/** What the agent sent, minus the page it named, under the names the shared tool expects. */
const toSharedInput = ({
	args,
	renames = [],
}: {
	args: Record<string, unknown>;
	renames?: InputRename[];
}): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(args)
			.filter(([key]) => !(key in pageScopeShape))
			.map(([key, value]) => [renames.find((rename) => rename.mcp === key)?.shared ?? key, value]),
	);

/**
 * Runs one shared page tool against the page the agent named. Tools that change the page wait
 * for earlier changes to the same page, so changes sent together land in order.
 */
const runPageTool = async ({
	deps,
	queue,
	spec,
	args,
}: {
	deps: ToolDeps;
	queue: KeyedQueue;
	spec: PageScopedTool;
	args: Record<string, unknown>;
}): Promise<McpTextResult> => {
	const scope = pageScopeSchema.parse(args);
	const ctx = createEntityContext({
		client: deps.client,
		contentType: scope.content_type,
		id: scope.id,
		toolName: spec.name,
	});
	const tool = requireTool({ tools: createPageTools(ctx), name: spec.sharedName });
	const run = () => tool.run(toSharedInput({ args, renames: spec.renames }));
	const result = tool.changesPage
		? await queue({ key: `${scope.content_type}:${scope.id}`, job: run })
		: await run();
	return toTextResult(result);
};

/**
 * Registers the page-editing tools. They are the same tools the in-editor assistant uses
 * (`createPageTools` from the SDK), so an agent here and the assistant there edit pages by
 * the same rules and get the same checks. Each page-scoped call loads the page fresh, edits
 * it and saves it with its version number.
 *
 * `list_media`, `list_pages` and `get_theme` are not taken from the shared set: MCP already
 * has tools by those names.
 */
export function registerPageEditingTools(deps: ToolDeps): void {
	const { server } = deps;
	const catalog = createPageTools(createNoPageContext());
	const queue = createKeyedQueue();

	for (const spec of PAGE_SCOPED_TOOLS) {
		const shared = requireTool({ tools: catalog, name: spec.sharedName });
		server.registerTool(
			spec.name,
			{
				title: shared.title,
				description: [SCOPE_NOTE, spec.leadNote, toMcpText(shared.description), spec.note]
					.filter(Boolean)
					.join(" "),
				inputSchema: toMcpInputShape({ tool: shared, renames: spec.renames }),
				annotations: { readOnlyHint: !shared.changesPage },
			},
			async (args: Record<string, unknown>) =>
				runTool(() => runPageTool({ deps, queue, spec, args })),
		);
	}

	for (const name of SITE_LEVEL_TOOLS) {
		const tool = requireTool({ tools: catalog, name });
		server.registerTool(
			name,
			{
				title: tool.title,
				description: toMcpText(tool.description),
				inputSchema: tool.inputShape,
				annotations: { readOnlyHint: true },
			},
			async (args: Record<string, unknown>) => runTool(async () => toTextResult(await tool.run(args))),
		);
	}
}
