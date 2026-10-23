import type { z } from "zod";
import type { BlockName } from "../block-catalog/block-names.js";
import type { BlockConfig } from "../schema-types.js";

/**
 * The page tools are written once and used by every agent: outside agents through
 * MCP (working on a saved page) and the in-editor assistant (working on the copy
 * open in the editor). The only thing that differs is where the tree lives, so the
 * tools take it through `readTree` / `writeTree`.
 */

/** One ordered change to a block tree. Ids are real block ids. */
export type BlockPatchOp =
	| { op: "insert"; parentId: string | null; index?: number; block: BlockConfig }
	| {
			op: "update";
			id: string;
			set: {
				label?: string;
				content?: BlockConfig["content"];
				styles?: BlockConfig["styles"];
				settings?: BlockConfig["settings"];
				customCss?: string;
				other?: BlockConfig["other"];
			};
	  }
	| { op: "delete"; id: string }
	| { op: "move"; id: string; parentId: string | null; index?: number }
	/** Swap a block and everything inside it for another block, in the same spot. */
	| { op: "replace"; id: string; block: BlockConfig };

/** What one accepted change did, with real ids, so the caller can show or stream it. */
export type TreeChange = {
	blocks: BlockConfig[];
	ops: BlockPatchOp[];
	summary: { inserted: string[]; updated: string[]; deleted: string[]; moved: string[]; replaced: string[] };
};

export type WriteTreeResult = { ok: true } | { ok: false; message: string };

export type MediaSummary = {
	id: string;
	url: string;
	name?: string;
	alt?: string;
	mimeType?: string;
	width?: number;
	height?: number;
};

/** `path` is the page's full address without the leading slash (`guides/install`); it equals `slug` for top-level pages. */
export type PageSummary = { id: string; title: string; slug: string; path?: string; status: string };

export type TemplatePartSummary = { id: string; name: string; rootBlock: string };

export type ThemeSummary = {
	name: string;
	/** Theme colour name → CSS value, e.g. `accent: "#2563eb"`. */
	colors: Record<string, string>;
	fonts?: { heading?: string; body?: string };
	radius?: string;
};

/** Read-only facts about the site. Each is optional; a tool whose lookup is missing is left out. */
export type SiteLookups = {
	listMedia?: (params: { search?: string; limit?: number }) => Promise<MediaSummary[]>;
	listPages?: () => Promise<PageSummary[]>;
	listTemplateParts?: () => Promise<TemplatePartSummary[]>;
	getTheme?: () => Promise<ThemeSummary>;
};

/** A tool step that threw. The tool turns it into a failed result for the model; this keeps the cause for the logs. */
export type ToolErrorReport = { tool: string; error: Error };

export type PageToolContext = {
	readTree: () => Promise<BlockConfig[]>;
	/** Called once per accepted change, after every check passed. */
	writeTree: (change: TreeChange) => Promise<WriteTreeResult>;
	/** When set, changes outside this block (and its children) are refused. */
	focusBlockId?: string | null;
	/** Makes new block ids. Must return UUIDs: form answers find their form by a UUID block id. */
	newId: () => string;
	site?: SiteLookups;
	/** Called when reading or writing the page, or a site lookup, throws. Lets the host log the cause with its own ids. */
	onError?: (report: ToolErrorReport) => void;
};

/** What a tool tells the agent. `text` is written for the model: short, exact, with ids. */
export type PageToolResult = { ok: boolean; text: string };

export type PageTool = {
	/** snake_case, stable: MCP clients and saved chats refer to tools by name. */
	name: string;
	title: string;
	/** For the model: when to use it and what it returns. */
	description: string;
	/** Zod raw shape, so MCP (`registerTool`) and the AI SDK (`z.object(shape)`) can both use it. */
	inputShape: z.ZodRawShape;
	/** True when the tool can change the page; read tools are safe to run any time. */
	changesPage: boolean;
	/** Input is checked against `inputShape` inside `run`; never trust the caller. */
	run: (input: Record<string, unknown>) => Promise<PageToolResult>;
};

/** A new block described by an agent: the tools fill in ids, defaults and structure. */
export type BlockSpec = {
	name: BlockName;
	/** The agent's own short name for this block, usable as an id by later ops in the same call. Never saved. */
	ref?: string;
	label?: string;
	/** The block's saved content fields (`value`, `level`, `url`, …), laid over its defaults. */
	content?: Record<string, unknown>;
	/** CSS styles, laid over the block's default styles. `null` removes a default. */
	styles?: Record<string, string | number | null>;
	/** A layer of an overlay Stack that fills behind the others instead of setting the size (`settings.stackFillBehind`). */
	fillBehind?: boolean;
	children?: BlockSpec[];
};
