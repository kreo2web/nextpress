import { useState, type ReactElement } from "react";
import { Sidebar } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePageAssistantContext } from "../assistant";
import { DocsFoldAllButton, DocsRailBodies, DocsRailTriggers, useDocsLibraryState } from "./DocsLibrarySidebar";
import { DocsPanelBodies, DocsPanelTriggers } from "./DocsPanelTabs";
import { useRequiredDocsMode } from "./docs-mode-context";
import { COMPACT_RAIL_CLASS, RAIL_HEADER_CLASS, RAIL_ICON_BUTTON_CLASS, RAIL_TITLE_CLASS } from "./docs-rail-classes";
import type { DocsPanelTab, DocsRailTab } from "./docs-types";

type Props = {
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
	onToggleSidebar: () => void;
};

const RAIL_TABS: ReadonlySet<string> = new Set<DocsRailTab>(["pages", "blocks", "assistant"]);

/**
 * The docs editor on narrow screens: one rail with both sides' tabs, Pages, Blocks and Assistant
 * on the first row and Page, Docs (and Block while one is picked) on the second. WHY one value for
 * both halves: whatever opened a tab last wins, whether it was the left side (a click on the
 * canvas's sidebar shows Pages) or the right one (a picked block shows Block).
 */
export function DocsCompactSidebar({ parentBlock, updateBlock, setHoverHighlight, onToggleSidebar }: Props): ReactElement {
	const { panel, rail, selectedBlock } = useRequiredDocsMode();
	const hasAssistant = usePageAssistantContext() !== null;
	const library = useDocsLibraryState();
	const [side, setSide] = useState<"rail" | "panel">("rail");
	const [seen, setSeen] = useState({ panelTab: panel.tab, railShown: rail.shown });
	if (panel.tab !== seen.panelTab || rail.shown !== seen.railShown) {
		setSeen({ panelTab: panel.tab, railShown: rail.shown });
		setSide(rail.shown !== seen.railShown ? "rail" : "panel");
	}
	const railTab: DocsRailTab = rail.tab === "assistant" && !hasAssistant ? "pages" : rail.tab;
	const value = side === "rail" ? railTab : panel.tab;
	const railCount = hasAssistant ? 3 : 2;

	return (
		<TooltipProvider delayDuration={300}>
			<aside className={COMPACT_RAIL_CLASS} aria-label="Docs editor">
				<div className={RAIL_HEADER_CLASS}>
					<h2 className={RAIL_TITLE_CLASS}>Docs editor</h2>
					<div className="flex shrink-0 items-center gap-0.5">
						{value === "blocks" ? <DocsFoldAllButton library={library} /> : null}
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
				<Tabs
					value={value}
					onValueChange={(next) => {
						if (RAIL_TABS.has(next)) {
							rail.setTab(next as DocsRailTab);
							return;
						}
						setSide("panel");
						panel.setTab(next as DocsPanelTab);
					}}
					className="flex min-h-0 flex-1 flex-col gap-0 p-3"
				>
					<TabsList className={`grid h-auto w-full gap-1 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1 ${railCount === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
						<DocsRailTriggers hasAssistant={hasAssistant} />
					</TabsList>
					<TabsList className={`mt-1 grid h-auto w-full gap-1 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1 ${selectedBlock ? "grid-cols-3" : "grid-cols-2"}`}>
						<DocsPanelTriggers hasBlock={Boolean(selectedBlock)} />
					</TabsList>
					<DocsRailBodies hasAssistant={hasAssistant} library={library} />
					<DocsPanelBodies spaced selectedBlock={selectedBlock} parentBlock={parentBlock} updateBlock={updateBlock} setHoverHighlight={setHoverHighlight} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}
