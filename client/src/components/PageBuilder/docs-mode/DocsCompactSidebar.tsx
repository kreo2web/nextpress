import { useState, type ReactElement } from "react";
import { MessageSquare, Plus, Sidebar } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel, usePageAssistantContext } from "../assistant";
import { DocsBlockLibrary } from "./DocsBlockLibrary";
import { DocsPanelBodies, DocsPanelTriggers } from "./DocsPanelTabs";
import { useRequiredDocsMode } from "./docs-mode-context";
import { COMPACT_RAIL_CLASS, RAIL_HEADER_CLASS, RAIL_ICON_BUTTON_CLASS, RAIL_TITLE_CLASS, TAB_TRIGGER_CLASS, tabListClass } from "./docs-rail-classes";
import type { DocsPanelTab } from "./docs-types";

type LeftTab = "blocks" | "assistant";

type Props = {
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
	onToggleSidebar: () => void;
};

/**
 * The docs editor on narrow screens: one rail with Blocks, Assistant, Page and Docs tabs (and
 * Block while a block is picked). WHY one value for both halves: the page change that opens a tab
 * (a click on the canvas's sidebar, a picked block) must win over the tab you were last on, so the
 * Blocks and Assistant choice is dropped whenever the panel's own tab changes.
 */
export function DocsCompactSidebar({ parentBlock, updateBlock, setHoverHighlight, onToggleSidebar }: Props): ReactElement {
	const { panel, selectedBlock } = useRequiredDocsMode();
	const hasAssistant = usePageAssistantContext() !== null;
	const [left, setLeft] = useState<LeftTab | null>("blocks");
	const [lastPanelTab, setLastPanelTab] = useState<DocsPanelTab>(panel.tab);
	if (panel.tab !== lastPanelTab) {
		setLastPanelTab(panel.tab);
		setLeft(null);
	}
	const value = left ?? panel.tab;
	const count = 3 + (hasAssistant ? 1 : 0) + (selectedBlock ? 1 : 0);

	return (
		<TooltipProvider delayDuration={300}>
			<aside className={COMPACT_RAIL_CLASS} aria-label="Docs editor">
				<div className={RAIL_HEADER_CLASS}>
					<h2 className={RAIL_TITLE_CLASS}>Docs editor</h2>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button type="button" variant="ghost" size="sm" onClick={onToggleSidebar} className={RAIL_ICON_BUTTON_CLASS} aria-label="Collapse sidebar">
								<Sidebar className="h-5 w-5" aria-hidden />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Collapse sidebar</TooltipContent>
					</Tooltip>
				</div>
				<Tabs
					value={value}
					onValueChange={(next) => {
						if (next === "blocks" || next === "assistant") setLeft(next);
						else {
							setLeft(null);
							panel.setTab(next as DocsPanelTab);
						}
					}}
					className="flex min-h-0 flex-1 flex-col gap-0 p-3"
				>
					<TabsList className={tabListClass(count)}>
						<TabsTrigger value="blocks" className={TAB_TRIGGER_CLASS}>
							<Plus className="h-4 w-4" aria-hidden /> Blocks
						</TabsTrigger>
						{hasAssistant ? (
							<TabsTrigger value="assistant" className={TAB_TRIGGER_CLASS}>
								<MessageSquare className="h-4 w-4" aria-hidden /> Assistant
							</TabsTrigger>
						) : null}
						<DocsPanelTriggers hasBlock={Boolean(selectedBlock)} />
					</TabsList>
					<TabsContent value="blocks" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
						<DocsBlockLibrary />
					</TabsContent>
					{hasAssistant ? (
						<TabsContent value="assistant" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
							<AssistantPanel />
						</TabsContent>
					) : null}
					<DocsPanelBodies spaced selectedBlock={selectedBlock} parentBlock={parentBlock} updateBlock={updateBlock} setHoverHighlight={setHoverHighlight} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}
