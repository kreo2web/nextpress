import type { ReactElement } from "react";
import { ChevronsDownUp, ChevronsUpDown, Sidebar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel, usePageAssistantContext } from "../assistant";
import { useBuilderLibraryState, type BuilderLibraryState } from "../use-builder-library-state";
import { DocsBlockLibrary } from "./DocsBlockLibrary";
import { DocsPagesPanel } from "./DocsPagesPanel";
import { buildDocsLibraryCategories } from "./docs-library";
import { useRequiredDocsMode } from "./docs-mode-context";
import { LIBRARY_RAIL_CLASS, RAIL_HEADER_CLASS, RAIL_ICON_BUTTON_CLASS, RAIL_TITLE_CLASS, TAB_TRIGGER_CLASS, tabListClass } from "./docs-rail-classes";
import type { DocsRailTab } from "./docs-types";

/** The docs sections, open and folded as the page builder's block groups are. */
export const useDocsLibraryState = (): BuilderLibraryState => useBuilderLibraryState({ build: buildDocsLibraryCategories });

/** The page builder's "fold all" button, for the docs block sections. */
export function DocsFoldAllButton({ library }: { library: BuilderLibraryState }): ReactElement {
	const label = library.allLibraryGroupsExpanded ? "Collapse all block groups" : "Expand all block groups";
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="ghost" size="sm" className={RAIL_ICON_BUTTON_CLASS} aria-label={label} onClick={library.onToggleLibraryFold} disabled={library.categories.length === 0}>
					{library.allLibraryGroupsExpanded ? <ChevronsDownUp className="h-5 w-5" aria-hidden /> : <ChevronsUpDown className="h-5 w-5" aria-hidden />}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** The left rail's own tab triggers, text only like the right panel's (three icons and words don't fit the rail). */
export function DocsRailTriggers({ hasAssistant }: { hasAssistant: boolean }): ReactElement {
	return (
		<>
			<TabsTrigger value="pages" className={TAB_TRIGGER_CLASS}>
				Pages
			</TabsTrigger>
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

const BODY_CLASS = "mt-4 flex min-h-0 flex-1 flex-col overflow-hidden";

/** What each left tab shows. Only the open tab is mounted. */
export function DocsRailBodies({ hasAssistant, library }: { hasAssistant: boolean; library: BuilderLibraryState }): ReactElement {
	return (
		<>
			<TabsContent value="pages" className={BODY_CLASS}>
				<DocsPagesPanel />
			</TabsContent>
			<TabsContent value="blocks" className={BODY_CLASS}>
				<DocsBlockLibrary library={library} />
			</TabsContent>
			{hasAssistant ? (
				<TabsContent value="assistant" className={BODY_CLASS}>
					<AssistantPanel />
				</TabsContent>
			) : null}
		</>
	);
}

/**
 * The docs editor's left rail on wide screens: the docs' pages, the docs blocks (and only those),
 * and the assistant. Page and Docs settings are on the right. The tab is remembered per browser,
 * and a click on the canvas's sidebar brings up Pages.
 */
export function DocsLibrarySidebar({ onToggleSidebar }: { onToggleSidebar: () => void }): ReactElement {
	const { rail } = useRequiredDocsMode();
	const hasAssistant = usePageAssistantContext() !== null;
	const library = useDocsLibraryState();
	const tab: DocsRailTab = rail.tab === "assistant" && !hasAssistant ? "pages" : rail.tab;

	return (
		<TooltipProvider delayDuration={300}>
			<aside className={LIBRARY_RAIL_CLASS} aria-label="Docs pages, blocks and assistant">
				<div className={RAIL_HEADER_CLASS}>
					<h2 className={RAIL_TITLE_CLASS}>Docs editor</h2>
					<div className="flex shrink-0 items-center gap-0.5">
						{tab === "blocks" ? <DocsFoldAllButton library={library} /> : null}
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
				<Tabs value={tab} onValueChange={(next) => rail.setTab(next as DocsRailTab)} className="flex min-h-0 flex-1 flex-col gap-0 p-3 sm:p-4">
					<TabsList className={tabListClass(hasAssistant ? 3 : 2)}>
						<DocsRailTriggers hasAssistant={hasAssistant} />
					</TabsList>
					<DocsRailBodies hasAssistant={hasAssistant} library={library} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}
