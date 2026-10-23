import type { BlockConfig } from "@shared/schema-types";
import { createDefaultBlock } from "@shared/block-catalog";
import { DEFAULT_TAB_CONTENT, TAB_BLOCK_NAME } from "@shared/blocks/tabs-model";
import { generateBlockId } from "../../utils";

/**
 * A new tab exactly as the catalog starts one (with its paragraph), so the editor, the SDK and
 * the AI builder agree. Returns null only if the catalog lost the tab block.
 */
export function buildTab({ parentId, title }: { parentId: string; title: string }): BlockConfig | null {
	const tab = createDefaultBlock({ name: TAB_BLOCK_NAME, id: generateBlockId(), newId: generateBlockId });
	if (!tab) return null;
	return { ...tab, parentId, content: { kind: "structured", data: { ...DEFAULT_TAB_CONTENT, title } } };
}

/** The tab that holds `blockId` (the tab itself or anything inside it), or null. */
export const findOwningTabId = ({ tabs, blockId }: { tabs: readonly BlockConfig[]; blockId: string | null }): string | null => {
	if (!blockId) return null;
	const contains = (node: BlockConfig): boolean =>
		node.id === blockId || (node.children ?? []).some(contains);
	return tabs.find(contains)?.id ?? null;
};
