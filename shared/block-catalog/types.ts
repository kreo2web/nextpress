import type { BlockConfig, BlockContent } from "../schema-types.js";
import type { BlockName } from "./block-names.js";

export type BlockCatalogCategory = "basic" | "form" | "layout" | "media" | "docs" | "advanced" | "post";

/** Where a block may sit. Only rules the editor or server already enforce are recorded. */
export type BlockPlacement = {
	/** One per page, at the page root. */
	rootOnly?: true;
	/** Only directly inside one of these blocks. */
	parents?: readonly BlockName[];
};

export type StartingChildrenParams = { parentId: string; newId: () => string };

/**
 * One block as NextPress knows it. Plain data and pure functions only — the SDK
 * packs this folder into its build, so nothing here may load React or the DOM.
 */
export type BlockCatalogEntry = {
	name: BlockName;
	label: string;
	/** Shown to people in the block library. */
	description: string;
	category: BlockCatalogCategory;
	/**
	 * Other groups that list this block too (the Docs group shows `core/code`, `core/image` and
	 * more). The block keeps one name and one home `category`; this only decides where the block
	 * library and `list_block_types` show it.
	 */
	alsoIn?: BlockCatalogCategory[];
	/** Containers hold child blocks; other blocks never do. */
	kind: "block" | "container";
	/** What a new block saves as content (the stored shape). A fresh object every call. */
	defaultContent: () => BlockContent;
	/** The block's own look, laid over `INSERTED_BLOCK_BASE_STYLES`. */
	defaultStyles: Record<string, string | number>;
	/** Blocks a new container starts with (an accordion's first items). */
	defaultChildren?: (params: StartingChildrenParams) => BlockConfig[];
	placement?: BlockPlacement;
	/** How an agent should use this block ("use for…, not for…"). Comes from `agent-notes.ts`. */
	agentNote: string;
};

/** An entry as written in the per-group files; `entries.ts` adds its agent note. */
export type WrittenBlockEntry = Omit<BlockCatalogEntry, "agentNote">;
