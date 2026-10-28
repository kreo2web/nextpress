import { useState, type ReactElement } from "react";
import { PanelRightClose, Sidebar } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel, usePageAssistantContext } from "../assistant";
import BlockLibrary from "../BlockLibrary";
import { BuilderInspectorPanel } from "../BuilderInspectorPanel";
import { LIBRARY_PANEL_CLASS } from "../BuilderLibraryPanel";
import { useBuilderWideLayout } from "../BuilderResponsiveSidebar";
import { useBuilderLibraryState, type BuilderLibraryState } from "../use-builder-library-state";
import { DocsFoldAllButton } from "../docs-mode/DocsLibrarySidebar";
import { COMPACT_RAIL_CLASS, INSPECTOR_RAIL_CLASS, LIBRARY_RAIL_CLASS, RAIL_HEADER_CLASS, RAIL_ICON_BUTTON_CLASS, RAIL_TITLE_CLASS, TAB_TRIGGER_CLASS, tabListClass } from "../docs-mode/docs-rail-classes";
import { buildBlogLibraryCategories } from "./blog-library";
import { useRequiredBlogMode, type BlogPanelTab } from "./blog-mode-context";
import { BlogPostTab } from "./BlogPostTab";
import { BlogSettingsTab } from "./BlogSettingsTab";

const useBlogLibraryState = (): BuilderLibraryState => useBuilderLibraryState({ build: buildBlogLibraryCategories });

/** The writing blocks, in the page builder's own block list: drag onto the post, or click to add after the picked block. */
function BlogBlockLibrary({ library }: { library: BuilderLibraryState }): ReactElement {
	const { insertBlock } = useRequiredBlogMode();
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="blog-block-library">
			<p className="npb-settings-hint-muted text-xs">Drag a block onto the post, or click it to add it after the picked block. In a paragraph, type / to pick one.</p>
			<div className={`${LIBRARY_PANEL_CLASS} min-h-0 flex-1`} role="region" aria-label="Writing blocks">
				<ScrollArea className="h-full rounded-[inherit]" bottomOverlay={<div className="npb-editor-scroll-fade" aria-hidden />}>
					<div className="max-w-full pr-2">
						<BlockLibrary categories={library.categories} openCategories={library.openCategories} onCategoryOpenChange={library.onCategoryOpenChange} onPick={(block) => insertBlock(block.id)} />
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

type PanelProps = {
	slug: string;
	onSlugChange: (slug: string) => void;
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
};

const SCROLL_CLASS = "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6";
const LEFT_BODY_CLASS = "mt-4 flex min-h-0 flex-1 flex-col overflow-hidden";

/** The right panel's tab triggers: Post and Blog always, Block while a block is picked. */
function PanelTriggers({ hasBlock }: { hasBlock: boolean }): ReactElement {
	return (
		<>
			<TabsTrigger value="post" className={TAB_TRIGGER_CLASS}>
				Post
			</TabsTrigger>
			<TabsTrigger value="blog" className={TAB_TRIGGER_CLASS}>
				Blog
			</TabsTrigger>
			{hasBlock ? (
				<TabsTrigger value="block" className={TAB_TRIGGER_CLASS}>
					Block
				</TabsTrigger>
			) : null}
		</>
	);
}

function PanelBodies({ slug, onSlugChange, parentBlock, updateBlock, setHoverHighlight, spaced = false }: PanelProps & { spaced?: boolean }): ReactElement {
	const { selectedBlock } = useRequiredBlogMode();
	const gap = spaced ? "mt-4" : "mt-0";
	return (
		<>
			<TabsContent value="post" className={`${SCROLL_CLASS} ${gap}`}>
				<BlogPostTab slug={slug} onSlugChange={onSlugChange} />
			</TabsContent>
			<TabsContent value="blog" className={`${SCROLL_CLASS} ${gap}`}>
				<BlogSettingsTab />
			</TabsContent>
			{selectedBlock ? (
				<TabsContent value="block" className={`${gap} flex min-h-0 flex-1 flex-col`}>
					<BuilderInspectorPanel selectedBlock={selectedBlock} parentBlock={parentBlock} updateBlock={updateBlock} setHoverHighlight={setHoverHighlight} />
				</TabsContent>
			) : null}
		</>
	);
}

/** The writing editor's right rail on wide screens. Picking a block opens Block; putting it down goes back to Post. */
export function BlogInspectorSidebar({ onToggleInspector, ...props }: PanelProps & { onToggleInspector: () => void }): ReactElement {
	const { tab, setTab, selectedBlock } = useRequiredBlogMode();
	return (
		<TooltipProvider delayDuration={300}>
			<aside className={INSPECTOR_RAIL_CLASS} aria-label="Post, blog and block settings">
				<Tabs value={tab} onValueChange={(next) => setTab(next as BlogPanelTab)} className="flex min-h-0 flex-1 flex-col gap-0">
					<div className="flex items-center gap-2 border-b border-npb-divider p-3">
						<TabsList className={`${tabListClass(selectedBlock ? 3 : 2)} flex-1`}>
							<PanelTriggers hasBlock={Boolean(selectedBlock)} />
						</TabsList>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="sm" onClick={onToggleInspector} className={RAIL_ICON_BUTTON_CLASS} aria-label="Collapse settings">
									<PanelRightClose className="h-5 w-5" aria-hidden />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">Collapse settings</TooltipContent>
						</Tooltip>
					</div>
					<PanelBodies {...props} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}

type LeftTab = "blocks" | "assistant";

function RailHeader({ library, showFold, onToggleSidebar }: { library: BuilderLibraryState; showFold: boolean; onToggleSidebar: () => void }): ReactElement {
	return (
		<div className={RAIL_HEADER_CLASS}>
			<h2 className={RAIL_TITLE_CLASS}>Writing</h2>
			<div className="flex shrink-0 items-center gap-0.5">
				{showFold ? <DocsFoldAllButton library={library} /> : null}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button type="button" variant="ghost" size="sm" onClick={onToggleSidebar} className={RAIL_ICON_BUTTON_CLASS} aria-label="Collapse sidebar">
							<Sidebar className="h-5 w-5" aria-hidden />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Collapse sidebar</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}

function LeftTriggers({ hasAssistant }: { hasAssistant: boolean }): ReactElement {
	return (
		<>
			<TabsTrigger value="blocks" className={TAB_TRIGGER_CLASS}>
				Blocks
			</TabsTrigger>
			{hasAssistant ? (
				<TabsTrigger value="assistant" className={TAB_TRIGGER_CLASS}>
					Assistant
				</TabsTrigger>
			) : null}
		</>
	);
}

function LeftBodies({ hasAssistant, library }: { hasAssistant: boolean; library: BuilderLibraryState }): ReactElement {
	return (
		<>
			<TabsContent value="blocks" className={LEFT_BODY_CLASS}>
				<BlogBlockLibrary library={library} />
			</TabsContent>
			{hasAssistant ? (
				<TabsContent value="assistant" className={LEFT_BODY_CLASS}>
					<AssistantPanel />
				</TabsContent>
			) : null}
		</>
	);
}

/** The writing editor's left rail on wide screens: the writing blocks and the assistant. */
function BlogLibrarySidebar({ onToggleSidebar }: { onToggleSidebar: () => void }): ReactElement {
	const hasAssistant = usePageAssistantContext() !== null;
	const library = useBlogLibraryState();
	const [tab, setTab] = useState<LeftTab>("blocks");
	return (
		<TooltipProvider delayDuration={300}>
			<aside className={LIBRARY_RAIL_CLASS} aria-label="Writing blocks and assistant">
				<RailHeader library={library} showFold={tab === "blocks"} onToggleSidebar={onToggleSidebar} />
				<Tabs value={tab} onValueChange={(next) => setTab(next as LeftTab)} className="flex min-h-0 flex-1 flex-col gap-0 p-3 sm:p-4">
					{hasAssistant ? (
						<TabsList className={tabListClass(2)}>
							<LeftTriggers hasAssistant />
						</TabsList>
					) : null}
					<LeftBodies hasAssistant={hasAssistant} library={library} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}

/**
 * The writing editor on narrow screens: one rail with Blocks (and Assistant) on the first row and
 * Post, Blog (and Block) on the second. Whichever side opened a tab last wins.
 */
function BlogCompactSidebar({ onToggleSidebar, ...props }: PanelProps & { onToggleSidebar: () => void }): ReactElement {
	const { tab: panelTab, setTab: setPanelTab, selectedBlock } = useRequiredBlogMode();
	const hasAssistant = usePageAssistantContext() !== null;
	const library = useBlogLibraryState();
	const [left, setLeft] = useState<LeftTab | null>("blocks");
	const [seenPanelTab, setSeenPanelTab] = useState(panelTab);
	if (panelTab !== seenPanelTab) {
		setSeenPanelTab(panelTab);
		setLeft(null);
	}
	const value = left ?? panelTab;
	return (
		<TooltipProvider delayDuration={300}>
			<aside className={COMPACT_RAIL_CLASS} aria-label="Writing editor">
				<RailHeader library={library} showFold={value === "blocks"} onToggleSidebar={onToggleSidebar} />
				<Tabs
					value={value}
					onValueChange={(next) => {
						if (next === "blocks" || next === "assistant") {
							setLeft(next);
							return;
						}
						setLeft(null);
						setPanelTab(next as BlogPanelTab);
					}}
					className="flex min-h-0 flex-1 flex-col gap-0 p-3"
				>
					<TabsList className={`grid h-auto w-full gap-1 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1 ${hasAssistant ? "grid-cols-2" : "grid-cols-1"}`}>
						<LeftTriggers hasAssistant={hasAssistant} />
					</TabsList>
					<TabsList className={`mt-1 grid h-auto w-full gap-1 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1 ${selectedBlock ? "grid-cols-3" : "grid-cols-2"}`}>
						<PanelTriggers hasBlock={Boolean(selectedBlock)} />
					</TabsList>
					<LeftBodies hasAssistant={hasAssistant} library={library} />
					<PanelBodies spaced {...props} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}

/** Wide screens get the blocks on the left and the settings on the right; narrow ones one rail with both. */
export function BlogResponsiveSidebar({ onToggleSidebar, ...props }: PanelProps & { onToggleSidebar: () => void }): ReactElement {
	return useBuilderWideLayout() ? <BlogLibrarySidebar onToggleSidebar={onToggleSidebar} /> : <BlogCompactSidebar onToggleSidebar={onToggleSidebar} {...props} />;
}
