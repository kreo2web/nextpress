import { useState, type ReactElement } from "react";
import { MessageSquare, Plus, Sidebar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel, usePageAssistantContext } from "../assistant";
import { DocsBlockLibrary } from "./DocsBlockLibrary";
import { LIBRARY_RAIL_CLASS, RAIL_HEADER_CLASS, RAIL_ICON_BUTTON_CLASS, RAIL_TITLE_CLASS, TAB_TRIGGER_CLASS, tabListClass } from "./docs-rail-classes";

type RailTab = "blocks" | "assistant";

/**
 * The docs editor's left rail on wide screens: the docs blocks (and only those) and the assistant.
 * Page and Docs settings are on the right, so this rail has the two things you drop or ask for.
 */
export function DocsLibrarySidebar({ onToggleSidebar }: { onToggleSidebar: () => void }): ReactElement {
	const hasAssistant = usePageAssistantContext() !== null;
	const [tab, setTab] = useState<RailTab>("blocks");
	return (
		<TooltipProvider delayDuration={300}>
			<aside className={LIBRARY_RAIL_CLASS} aria-label="Docs blocks and assistant">
				<div className={RAIL_HEADER_CLASS}>
					<h2 className={RAIL_TITLE_CLASS}>Docs editor</h2>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button type="button" variant="ghost" size="sm" onClick={onToggleSidebar} className={RAIL_ICON_BUTTON_CLASS} aria-label="Collapse block library">
								<Sidebar className="h-5 w-5" aria-hidden />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">Collapse block library</TooltipContent>
					</Tooltip>
				</div>
				<Tabs value={tab} onValueChange={(next) => setTab(next as RailTab)} className="flex min-h-0 flex-1 flex-col gap-0 p-3 sm:p-4">
					{hasAssistant ? (
						<TabsList className={tabListClass(2)}>
							<TabsTrigger value="blocks" className={TAB_TRIGGER_CLASS}>
								<Plus className="h-4 w-4" aria-hidden /> Blocks
							</TabsTrigger>
							<TabsTrigger value="assistant" className={TAB_TRIGGER_CLASS}>
								<MessageSquare className="h-4 w-4" aria-hidden /> Assistant
							</TabsTrigger>
						</TabsList>
					) : null}
					<TabsContent value="blocks" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
						<DocsBlockLibrary />
					</TabsContent>
					{hasAssistant ? (
						<TabsContent value="assistant" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
							<AssistantPanel />
						</TabsContent>
					) : null}
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}
