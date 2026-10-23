import type { BlockConfig } from "@shared/schema-types";
import { createDefaultBlock } from "@shared/block-catalog";
import { STEP_BLOCK_NAME } from "@shared/blocks/steps-model";
import { generateBlockId } from "../../utils";

/**
 * A new step exactly as the catalog starts one (title plus a paragraph), so the editor, the
 * SDK and the AI builder agree. Returns null only if the catalog lost the step block.
 */
export function buildStep({ parentId, title }: { parentId: string; title: string }): BlockConfig | null {
	const step = createDefaultBlock({ name: STEP_BLOCK_NAME, id: generateBlockId(), newId: generateBlockId });
	if (!step) return null;
	return { ...step, parentId, content: { kind: "structured", data: { title } } };
}
