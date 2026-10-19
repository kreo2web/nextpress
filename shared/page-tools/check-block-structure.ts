import { findBlockEntry } from "../block-catalog/entries.js";
import type { BlockConfig, BlockContent } from "../schema-types.js";
import { walkBlocks } from "./tree-find.js";

export const UNKNOWN_BLOCK = "UNKNOWN_BLOCK" as const;
export const INVALID_BLOCK_TYPE = "INVALID_BLOCK_TYPE" as const;
export const INVALID_BLOCK_STRUCTURE = "INVALID_BLOCK_STRUCTURE" as const;
export const DUPLICATE_BLOCK_ID = "DUPLICATE_BLOCK_ID" as const;

export type BlockValidationIssue = {
	code:
		| typeof UNKNOWN_BLOCK
		| typeof INVALID_BLOCK_TYPE
		| typeof INVALID_BLOCK_STRUCTURE
		| typeof DUPLICATE_BLOCK_ID;
	message: string;
	blockId?: string;
	blockName?: string;
};

export type ValidateBlockTreeResult =
	| { ok: true; blockCount: number }
	| { ok: false; issues: BlockValidationIssue[] };

/** The `kind` values a block's content may name. */
const CONTENT_KINDS: readonly string[] = ["text", "markdown", "media", "html", "structured", "empty", "list"];

/**
 * Content is an object. It names its `kind`, or has none: the editor saves `post/toc`,
 * `post/info` and `post/progress` as plain objects and the server accepts that.
 */
const isValidContentShape = (content: BlockContent): boolean => {
	if (content === undefined) return true;
	if (typeof content !== "object" || content === null) return false;
	if (!("kind" in content)) return true;
	return CONTENT_KINDS.includes(String(content.kind));
};

/**
 * Tree structure checks against the block catalog: missing or repeated ids, unknown block
 * names, a type that does not match the catalog, children on a block that cannot hold any,
 * and content with the wrong shape. Pure; it never touches the network.
 *
 * WHY here and not in the SDK: the server's assistant and the editor run the same checks
 * before a change is accepted, so the rules must live in one place they can all import.
 */
export const checkBlockStructure = (blocks: BlockConfig[]): ValidateBlockTreeResult => {
	const issues: BlockValidationIssue[] = [];
	const seenIds = new Set<string>();
	let blockCount = 0;

	walkBlocks({
		blocks,
		visit: (block) => {
			blockCount += 1;

			if (!block.id?.trim()) {
				issues.push({
					code: INVALID_BLOCK_STRUCTURE,
					message: "Block is missing a non-empty id",
					blockName: block.name,
				});
			} else if (seenIds.has(block.id)) {
				issues.push({
					code: DUPLICATE_BLOCK_ID,
					message: `Duplicate block id "${block.id}"`,
					blockId: block.id,
					blockName: block.name,
				});
			} else {
				seenIds.add(block.id);
			}

			const entry = findBlockEntry(block.name);
			if (!entry) {
				issues.push({
					code: UNKNOWN_BLOCK,
					message: `Unknown block name "${block.name}". Use list_block_types / blocks catalog.`,
					blockId: block.id,
					blockName: block.name,
				});
			} else {
				if (block.type !== entry.kind) {
					issues.push({
						code: INVALID_BLOCK_TYPE,
						message: `Block "${block.name}" must have type "${entry.kind}" (got "${block.type}")`,
						blockId: block.id,
						blockName: block.name,
					});
				}
				if (entry.kind === "block" && block.children && block.children.length > 0) {
					issues.push({
						code: INVALID_BLOCK_STRUCTURE,
						message: `Leaf block "${block.name}" cannot have children`,
						blockId: block.id,
						blockName: block.name,
					});
				}
			}

			if (!isValidContentShape(block.content)) {
				issues.push({
					code: INVALID_BLOCK_STRUCTURE,
					message: `Block "${block.id}" has invalid content shape`,
					blockId: block.id,
					blockName: block.name,
				});
			}
		},
	});

	if (issues.length > 0) return { ok: false, issues };
	return { ok: true, blockCount };
};
