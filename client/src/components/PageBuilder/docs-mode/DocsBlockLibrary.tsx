import type { ReactElement } from "react";
import { blocksToMdx } from "@shared/mdx-blocks";
import { createDefaultBlock } from "@shared/block-catalog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { generateBlockId } from "../utils";
import BlockLibrary from "../BlockLibrary";
import { LIBRARY_PANEL_CLASS } from "../BuilderLibraryPanel";
import type { BlockDefinition } from "../blocks/types";
import type { BuilderLibraryState } from "../use-builder-library-state";
import { useRequiredDocsMode } from "./docs-mode-context";

/** Where the block's MDX would go, from the block the catalog starts with; empty when it has no MDX form yet. */
const snippetFor = (name: string): string => {
	const block = createDefaultBlock({ name, id: generateBlockId(), newId: generateBlockId });
	return block ? blocksToMdx([block]).mdx.trimEnd() : "";
};

/**
 * The docs inserter: the page builder's own block list, showing the docs sections only. In the
 * Visual view a block is dragged onto the page, or clicked to add it after the picked block (so
 * the keyboard can add blocks too). In the MDX view a click writes the block's MDX at the cursor.
 * `library` holds which sections are open, so the rail's "fold all" button works on this list.
 */
export function DocsBlockLibrary({ library }: { library: BuilderLibraryState }): ReactElement {
	const docs = useRequiredDocsMode();
	const { toast } = useToast();
	const mdx = docs.editor.view === "mdx";

	const add = (block: BlockDefinition): void => {
		if (!mdx) {
			docs.insertBlock(block.id);
			return;
		}
		const snippet = snippetFor(block.id);
		if (!snippet) {
			toast({ title: `${block.label} can't be written as MDX yet`, description: "Add it from the Visual view instead." });
			return;
		}
		docs.mdxInsert.current?.(snippet);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="docs-block-library">
			<p className="npb-settings-hint-muted text-xs" aria-live="polite">
				{mdx ? "Click a block to add its MDX where the cursor is." : "Drag a block onto the page, or click it to add it after the picked block."}
			</p>
			<div className={`${LIBRARY_PANEL_CLASS} min-h-0 flex-1`} role="region" aria-label="Docs blocks">
				<ScrollArea className="h-full rounded-[inherit]" bottomOverlay={<div className="npb-editor-scroll-fade" aria-hidden />}>
					<div className="max-w-full pr-2">
						<BlockLibrary
							categories={library.categories}
							openCategories={library.openCategories}
							onCategoryOpenChange={library.onCategoryOpenChange}
							onPick={add}
							dragDisabled={mdx}
						/>
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
