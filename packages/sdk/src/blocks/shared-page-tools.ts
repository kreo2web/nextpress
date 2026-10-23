/**
 * The one place the SDK reads the repo's shared page engine (`shared/page-tools/`): patching a
 * block tree, checking its structure, the page outline, the page check and the page tools.
 * Everything else in the SDK imports from here, never from `shared/` directly.
 *
 * WHY a bridge: the shared files are typed with the app's own `BlockConfig`, which reaches React's
 * `CSSProperties`. The published SDK must not, so every value that touches a block is re-typed
 * here, once, with the SDK's own types (`types/domain.ts`). `scripts/check-dist.mjs` fails the
 * build if a React or `shared/` path ever leaks into the published files.
 */

import {
	buildBlockFromSpec as buildSharedBlockFromSpec,
	checkBlockStructure,
	checkPage as checkSharedPage,
	createPageTools as createSharedPageTools,
	normalizeBlockSubtree as normalizeSharedBlockSubtree,
	normalizeBlockTree as normalizeSharedBlockTree,
	outlinePage as outlineSharedPage,
	patchBlockTree as patchSharedBlockTree,
} from "../../../../shared/page-tools/index.js";
import type {
	BlockSpec,
	BlockValidationIssue,
	CheckPageResult,
	PageTool,
	SiteLookups,
	ToolErrorReport,
	ValidateBlockTreeResult,
	WriteTreeResult,
} from "../../../../shared/page-tools/index.js";
import type { BlockConfig } from "../types/domain.js";

export {
	createBlockSpecSchema,
	DUPLICATE_BLOCK_ID,
	INVALID_BLOCK_STRUCTURE,
	INVALID_BLOCK_TYPE,
	layoutEqualColumns,
	PAGE_DESIGN_GUIDE,
	UNKNOWN_BLOCK,
} from "../../../../shared/page-tools/index.js";
export type {
	BlockSpec,
	BlockValidationIssue,
	EqualColumn,
	CheckPageResult,
	MediaSummary,
	PageProblem,
	PageProblemKind,
	PageSummary,
	PageTool,
	PageToolResult,
	SiteLookups,
	TemplatePartSummary,
	ThemeSummary,
	ToolErrorReport,
	ValidateBlockTreeResult,
	WriteTreeResult,
} from "../../../../shared/page-tools/index.js";

/** One ordered change to a block tree. Ids are real block ids. */
export type BlockPatchOp =
	| {
			op: "insert";
			/** null = root of the page tree */
			parentId: string | null;
			/** Default: append */
			index?: number;
			block: BlockConfig;
	  }
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
	| {
			op: "move";
			id: string;
			parentId: string | null;
			index?: number;
	  }
	/** Swap a block and everything inside it for another block, in the same spot. */
	| { op: "replace"; id: string; block: BlockConfig };

/** Ids by kind of change. For `replaced`, the ids of the new blocks. */
export type TreeChangeSummary = {
	inserted: string[];
	updated: string[];
	deleted: string[];
	moved: string[];
	replaced: string[];
};

export type PatchBlockTreeOk = {
	ok: true;
	blocks: BlockConfig[];
	summary: TreeChangeSummary;
};

export type PatchBlockTreeErr = {
	ok: false;
	error: {
		code: "PATCH_FAILED" | "VALIDATION_FAILED";
		message: string;
		opIndex?: number;
		blockId?: string;
		issues?: BlockValidationIssue[];
	};
};

export type PatchBlockTreeResult = PatchBlockTreeOk | PatchBlockTreeErr;

/** What one accepted change did, with real ids, so the caller can show or stream it. */
export type TreeChange = {
	blocks: BlockConfig[];
	ops: BlockPatchOp[];
	summary: TreeChangeSummary;
};

/**
 * The page tools are written once for every agent: outside agents through MCP (a saved page)
 * and an in-editor assistant (the copy open in the editor). Only where the tree lives differs,
 * so the tools take it through `readTree` / `writeTree`.
 */
export type PageToolContext = {
	readTree: () => Promise<BlockConfig[]>;
	/** Called once per accepted change, after every check passed. */
	writeTree: (change: TreeChange) => Promise<WriteTreeResult>;
	/** When set, changes outside this block (and its children) are refused. */
	focusBlockId?: string | null;
	/** Makes new block ids. Must return UUIDs: form answers find their form by a UUID block id. */
	newId: () => string;
	site?: SiteLookups;
	/** Called when reading or writing the page, or a site lookup, throws. Keeps the cause for the logs. */
	onError?: (report: ToolErrorReport) => void;
};

export type OutlinePageParams = {
	blocks: BlockConfig[];
	/** The selected block; its line is marked "← selected". */
	focusBlockId?: string | null;
	/** Longest text, label or url shown per line. Default 60 characters. */
	maxText?: number;
	/** Hides blocks deeper than this (root blocks are depth 0). */
	maxDepth?: number;
};

/** A block described by an agent, to build into a real block. */
export type BuildFromSpecParams = {
	spec: BlockSpec;
	/** The block this one will sit in, or null for the page root. */
	parentId: string | null;
	/** That block itself, when the caller has it. Needed only to check `fillBehind`. */
	parent?: BlockConfig | null;
	/** Makes every id: the block's own, its starting children's and its specified children's. */
	newId: () => string;
};

type BuildBlockFromSpecResult = { ok: true; value: BlockConfig } | { ok: false; message: string };

// Cast: the shared function is typed with the app's `BlockConfig`; the SDK's differs only in
// React-typed `styles` and a few extra content fields.
export const patchBlockTree = patchSharedBlockTree as (params: {
	blocks: BlockConfig[];
	ops: BlockPatchOp[];
	validate?: boolean;
}) => PatchBlockTreeResult;

// Cast: same re-typing as `patchBlockTree`.
export const normalizeBlockTree = normalizeSharedBlockTree as (
	blocks: BlockConfig[],
	parentId?: string | null,
) => BlockConfig[];

// Cast: same re-typing as `patchBlockTree`.
export const normalizeBlockSubtree = normalizeSharedBlockSubtree as (block: BlockConfig) => BlockConfig;

// Cast: same re-typing as `patchBlockTree`.
export const validateBlockTree = checkBlockStructure as (blocks: BlockConfig[]) => ValidateBlockTreeResult;

// Cast: same re-typing as `patchBlockTree`.
export const outlinePage = outlineSharedPage as (params: OutlinePageParams) => string;

// Cast: same re-typing as `patchBlockTree`.
export const checkPage = checkSharedPage as (params: {
	blocks: BlockConfig[];
	contentType?: "page" | "post";
}) => CheckPageResult;

// Cast: same re-typing as `patchBlockTree`.
export const buildBlockFromSpec = buildSharedBlockFromSpec as (
	params: BuildFromSpecParams,
) => BuildBlockFromSpecResult;

// Cast: the context carries `BlockConfig` in `readTree` / `writeTree`; the tools only read and write blocks through them.
export const createPageTools = createSharedPageTools as (ctx: PageToolContext) => PageTool[];
