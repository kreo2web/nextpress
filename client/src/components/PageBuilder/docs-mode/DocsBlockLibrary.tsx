import { useMemo, useState, type ReactElement } from "react";
import { Box, Search, X } from "lucide-react";
import { blocksToMdx } from "@shared/mdx-blocks";
import { createDefaultBlock } from "@shared/block-catalog";
import { Draggable, Droppable } from "@/lib/dnd";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateBlockId } from "../utils";
import { buildBlockLibraryCategories } from "../BlockLibrary";
import type { BlockDefinition } from "../blocks/types";
import { docsBlockLabel, groupDocsBlocks, searchDocsBlocks } from "./docs-library";
import { useRequiredDocsMode } from "./docs-mode-context";

const SEARCH_ID = "docs-block-search";

/** Where the block's MDX would go, from the block the catalog starts with; empty when it has no MDX form yet. */
const snippetFor = (name: string): string => {
	const block = createDefaultBlock({ name, id: generateBlockId(), newId: generateBlockId });
	return block ? blocksToMdx([block]).mdx.trimEnd() : "";
};

/**
 * The docs inserter: only the Docs group, sorted into sections, searchable. In the Visual view a
 * block is dragged onto the page (or clicked, which adds it after the picked block, so the
 * keyboard can add blocks too). In the MDX view a click writes the block's MDX at the cursor.
 */
export function DocsBlockLibrary(): ReactElement {
	const docs = useRequiredDocsMode();
	const { toast } = useToast();
	const [query, setQuery] = useState("");
	const mdx = docs.editor.view === "mdx";
	const blocks = useMemo(() => buildBlockLibraryCategories({ mode: "docs" }).flatMap((category) => category.blocks), []);
	const sections = useMemo(() => groupDocsBlocks(searchDocsBlocks({ blocks, query })), [blocks, query]);
	let index = 0;

	const add = (block: BlockDefinition): void => {
		if (!mdx) {
			docs.insertBlock(block.id);
			return;
		}
		const snippet = snippetFor(block.id);
		if (!snippet) {
			toast({ title: `${docsBlockLabel(block)} can't be written as MDX yet`, description: "Add it from the Visual view instead." });
			return;
		}
		docs.mdxInsert.current?.(snippet);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="docs-block-library">
			<p className="npb-settings-hint-muted text-xs" aria-live="polite">
				{mdx ? "Click a block to add its MDX where the cursor is." : "Drag a block onto the page, or click it to add it after the picked block."}
			</p>
			<div className="relative">
				<label htmlFor={SEARCH_ID} className="sr-only">
					Find a docs block
				</label>
				<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-npb-text-muted" aria-hidden />
				<Input id={SEARCH_ID} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a docs block" className="h-9 pl-9 pr-9 text-sm" />
				{query ? (
					<button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-npb-text-muted hover:text-npb-text-primary">
						<X className="h-4 w-4" aria-hidden />
					</button>
				) : null}
			</div>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				{query.trim() && sections.length === 0 ? <p className="px-1 py-6 text-center text-sm text-npb-text-muted">No docs block matches “{query.trim()}”.</p> : null}
				{sections.map((section) => {
					const start = index;
					index += section.blocks.length;
					return (
						<section key={section.id} aria-label={section.name}>
							<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-npb-text-muted">{section.name}</h3>
							<Droppable droppableId={`block-library-${section.id}`} isDropDisabled>
								{(provided) => (
									<div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-2 gap-2">
										{section.blocks.map((block, position) => (
											<Draggable key={block.id} draggableId={block.id} index={start + position} isDragDisabled={mdx}>
												{(drag, snapshot) => (
													<div ref={drag.innerRef} {...drag.draggableProps} data-dnd-debug-id={block.id}>
														<button
															type="button"
															{...drag.dragHandleProps}
															onClick={() => add(block)}
															title={block.description}
															className={`flex h-9 w-full items-center gap-2 rounded-[var(--npb-radius-input)] border border-npb-border-default bg-npb-surface-base px-2.5 text-left text-sm font-medium text-npb-text-primary hover:border-npb-border-strong hover:bg-npb-interactive-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus ${snapshot.isDragging ? "opacity-60" : ""}`}
														>
															{block.icon ? <block.icon className="h-4 w-4 shrink-0 text-npb-text-secondary" aria-hidden /> : <Box className="h-4 w-4 shrink-0 text-npb-text-secondary" aria-hidden />}
															<span className="min-w-0 truncate">{docsBlockLabel(block)}</span>
														</button>
													</div>
												)}
											</Draggable>
										))}
										{provided.placeholder}
									</div>
								)}
							</Droppable>
						</section>
					);
				})}
			</div>
		</div>
	);
}
