import { PAGE_DESIGN_GUIDE } from "@shared/block-catalog";
import { BLOCK_CATALOG } from "@shared/block-catalog/entries";
import { outlinePage } from "@shared/page-tools";
import type { BlockConfig } from "@shared/schema-types";

const HOUSE_RULES = `House rules:
- When a block is selected, change only that block and what is inside it. The tools refuse anything else.
- Work in small steps: one section or one change per tool call.
- If the person says no to a removal, that answer stands for the whole request: don't remove the same blocks another way (a part of them, their parent, a replace). Say what you left in place and stop.
- To fill a block you are making in the same change, give it a ref ("hero") and use the ref as parentId in a later op.
- Every change reply checks the page. Run apply_phone_fixes only when a reply lists phone warnings; you don't need check_page after a change.
- Never publish. Saving and publishing stay with the person.
- Finish with one or two plain sentences about what you changed.`;

const blockList = (): string =>
	BLOCK_CATALOG.map((entry) => `${entry.name} — ${entry.label}: ${entry.agentNote}`).join("\n");

/**
 * Instructions for one run: the design guide, a short block list, the page outline,
 * the selected block, and the house rules. The full tree stays out of the prompt.
 */
export const buildAssistantInstructions = ({
	blocks,
	focusBlockId,
}: {
	blocks: BlockConfig[];
	focusBlockId?: string | null;
}): string => {
	const selected = focusBlockId
		? `Selected block: id ${focusBlockId}. Stay inside it.`
		: "No block is selected. You may change the whole page.";

	return [
		PAGE_DESIGN_GUIDE,
		"",
		"## Blocks you can use",
		blockList(),
		"",
		"## This page",
		outlinePage({ blocks, focusBlockId }),
		selected,
		"",
		HOUSE_RULES,
	].join("\n");
};
