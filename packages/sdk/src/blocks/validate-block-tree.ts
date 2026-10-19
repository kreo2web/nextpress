import type { BlockContent } from "../types/domain.js";
import { BLOCK_DEFINITIONS, type BlockName } from "./block-definitions.js";

/**
 * The structure checks live in `shared/page-tools/` (one copy for the editor, the server and
 * the SDK). `validateBlockTree` catches unknown names, type mismatches, missing ids, duplicate
 * ids, children on a leaf and badly shaped content.
 */
export {
	type BlockValidationIssue,
	DUPLICATE_BLOCK_ID,
	INVALID_BLOCK_STRUCTURE,
	INVALID_BLOCK_TYPE,
	UNKNOWN_BLOCK,
	type ValidateBlockTreeResult,
	validateBlockTree,
} from "./shared-page-tools.js";

/** Machine-readable catalog for MCP / agents (schemas are descriptive, not full JSON Schema draft). */
export type BlockSchemaCatalogEntry = {
	name: BlockName;
	label: string;
	type: "block" | "container";
	category: string;
	allowsChildren: boolean;
	defaultContentKind: string;
};

/** "plain" is a bare object with no `kind` (post/toc, post/info, post/progress); "empty" is no content. */
const readContentKind = (content: BlockContent): string => {
	if (!content || typeof content !== "object") return "empty";
	return "kind" in content ? String(content.kind) : "plain";
};

export function buildBlockSchemaCatalog(): {
	version: 1;
	blocks: BlockSchemaCatalogEntry[];
} {
	const blocks = (Object.keys(BLOCK_DEFINITIONS) as BlockName[]).map((name) => {
		const def = BLOCK_DEFINITIONS[name];
		const defaultContentKind = readContentKind(def.defaultContent());
		return {
			name: def.name,
			label: def.label,
			type: def.type,
			category: def.category,
			allowsChildren: def.type === "container",
			defaultContentKind,
		};
	});
	return { version: 1, blocks };
}
