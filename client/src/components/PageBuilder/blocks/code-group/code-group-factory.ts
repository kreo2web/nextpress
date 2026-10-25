import type { BlockConfig } from "@shared/schema-types";
import { createDefaultBlock } from "@shared/block-catalog";
import { generateBlockId } from "../../utils";

const CODE_BLOCK_NAME = "core/code";

/**
 * A new code block for a group, exactly as the catalog starts one, titled so its tab has a name
 * and with no outer margin (the group spaces its code). Returns null only if the catalog lost the block.
 */
export function buildGroupCode({ parentId, title }: { parentId: string; title: string }): BlockConfig | null {
	const code = createDefaultBlock({ name: CODE_BLOCK_NAME, id: generateBlockId(), newId: generateBlockId });
	if (!code) return null;
	const data = code.content && typeof code.content === "object" && "data" in code.content ? code.content.data : {};
	return { ...code, parentId, content: { kind: "structured", data: { ...data, title } }, styles: { ...code.styles, margin: "0" } };
}
