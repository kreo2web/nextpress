import type { ReactElement } from "react";
import { PanelRightClose } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DocsPanelBodies, DocsPanelTriggers } from "./DocsPanelTabs";
import { useRequiredDocsMode } from "./docs-mode-context";
import { INSPECTOR_RAIL_CLASS, RAIL_ICON_BUTTON_CLASS, tabListClass } from "./docs-rail-classes";
import type { DocsPanelTab } from "./docs-types";

type Props = {
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
	onToggleInspector: () => void;
};

/**
 * The docs editor's right rail: Page and Docs tabs, plus Block while a block is picked. Picking a
 * block opens Block, and putting it down goes back to Page (`useDocsPanel`).
 */
export function DocsInspectorSidebar({ parentBlock, updateBlock, setHoverHighlight, onToggleInspector }: Props): ReactElement {
	const { panel, selectedBlock } = useRequiredDocsMode();
	return (
		<TooltipProvider delayDuration={300}>
			<aside className={INSPECTOR_RAIL_CLASS} aria-label="Page, docs and block settings">
				<Tabs value={panel.tab} onValueChange={(tab) => panel.setTab(tab as DocsPanelTab)} className="flex min-h-0 flex-1 flex-col gap-0">
					<div className="flex items-center gap-2 border-b border-npb-divider p-3">
						<TabsList className={`${tabListClass(selectedBlock ? 3 : 2)} flex-1`}>
							<DocsPanelTriggers hasBlock={Boolean(selectedBlock)} />
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
					<DocsPanelBodies selectedBlock={selectedBlock} parentBlock={parentBlock} updateBlock={updateBlock} setHoverHighlight={setHoverHighlight} />
				</Tabs>
			</aside>
		</TooltipProvider>
	);
}
