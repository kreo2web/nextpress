/**
 * The one place the SDK reads the repo's shared block list (`shared/block-catalog/`) and the shared
 * phone check. Everything else in the SDK imports from here, never from `shared/` directly.
 *
 * WHY a bridge: the shared files are typed with the app's own types, which reach React's
 * `CSSProperties`. The published SDK must not, so each value is re-typed with the SDK's own types
 * (`types/domain.ts`) here, once, and the build guard (`scripts/check-dist.mjs`) fails if a React
 * or `shared/` path ever leaks into the published files.
 */

import { newBlockOther as newSharedBlockOther } from "../../../../shared/block-catalog/content.js";
import {
	BLOCK_NAMES,
	type BlockName,
	createDefaultBlock as createSharedDefaultBlock,
	getBlockEntry as getSharedBlockEntry,
	INSERTED_BLOCK_BASE_STYLES,
	isBlockName,
	BLOCK_CATALOG as SHARED_BLOCK_CATALOG,
} from "../../../../shared/block-catalog/index.js";
import {
	applyResponsiveHealthFixes as applySharedResponsiveHealthFixes,
	type ResponsiveHealthIssue,
	type ResponsiveHealthResult,
	validateBlockResponsiveHealth as validateSharedBlockResponsiveHealth,
} from "../../../../shared/validate-block-responsive-health.js";
import type { BlockConfig, BlockContent } from "../types/domain.js";

export type { BlockName, ResponsiveHealthIssue, ResponsiveHealthResult };
export { BLOCK_NAMES, INSERTED_BLOCK_BASE_STYLES, isBlockName };

/** Where a block may sit. Only rules the editor or server already enforce are recorded. */
export type BlockPlacement = {
	/** One per page, at the page root. */
	rootOnly?: true;
	/** Only directly inside one of these blocks. */
	parents?: readonly BlockName[];
};

/** What a new container starts with: the parent's id and a way to make ids for starting children. */
export type StartingChildrenParams = { parentId: string; newId: () => string };

/** One block as NextPress knows it, typed with the SDK's own block types. */
export type BlockCatalogEntry = {
	name: BlockName;
	label: string;
	description: string;
	category: NonNullable<BlockConfig["category"]>;
	/** Other groups that list this block too (the Docs group shows `core/code` and more). */
	alsoIn?: NonNullable<BlockConfig["category"]>[];
	/** Containers hold child blocks; other blocks never do. */
	kind: "block" | "container";
	/** What a new block saves as content. A fresh object every call. */
	defaultContent: () => BlockContent;
	/** The block's own look, laid over `INSERTED_BLOCK_BASE_STYLES`. Every value is a string. */
	defaultStyles: Record<string, string>;
	/** Blocks a new container starts with (an accordion's first items). */
	defaultChildren?: (params: StartingChildrenParams) => BlockConfig[];
	placement?: BlockPlacement;
	/** How an agent should use this block ("use for…, not for…"). */
	agentNote: string;
};

type CreateDefaultBlockParams = { name: string; id: string; newId: () => string };

// Cast: the shared entry carries the app's block types; the SDK's differ only by the React-typed `styles`.
export const BLOCK_CATALOG = SHARED_BLOCK_CATALOG as readonly BlockCatalogEntry[];

/** The entry for a known block name. Throws when the catalog has none, which would be a bug in the catalog. */
export const getBlockEntry = (name: BlockName): BlockCatalogEntry =>
	// Cast: same re-typing as `BLOCK_CATALOG`, one entry at a time.
	getSharedBlockEntry(name) as BlockCatalogEntry;

/**
 * A new block exactly as the editor inserts it, or null for a name NextPress does not know.
 * The SDK builders and the editor share this one function so their blocks cannot drift apart.
 */
// Cast: the shared function returns the app's `BlockConfig`; this is the SDK's.
export const createDefaultBlock = createSharedDefaultBlock as (
	params: CreateDefaultBlockParams,
) => BlockConfig | null;

/** The `other` every new block starts with: no colour tokens and the editor's default units. */
export const newBlockOther: () => Record<string, unknown> = newSharedBlockOther;

/**
 * Checks a block tree for layouts that break on phones. Each issue may carry a one-click `fix`.
 */
// Cast: shared signature uses the app's `BlockConfig`.
export const validateBlockResponsiveHealth = validateSharedBlockResponsiveHealth as (
	blocks: BlockConfig[],
) => ResponsiveHealthResult;

/**
 * Applies every phone-check fix to the tree. Pure: returns new blocks and how many were fixed.
 */
// Cast: shared signature uses the app's `BlockConfig`.
export const applyResponsiveHealthFixes = applySharedResponsiveHealthFixes as (
	blocks: BlockConfig[],
) => { blocks: BlockConfig[]; fixedCount: number };
