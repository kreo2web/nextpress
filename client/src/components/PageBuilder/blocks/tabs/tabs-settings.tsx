import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { PanelTop, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Switch } from "@/components/ui/switch";
import { TAB_BLOCK_NAME, TABS_LOOKS, readTabsContent, type TabsContent } from "@shared/blocks/tabs-model";
import { SettingsChipGroup } from "../../settings-chip-group";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";
import { buildTab } from "./tabs-factory";

type TabsSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const LOOK_LABELS: Record<TabsContent["look"], string> = {
	underline: "Underline",
	pills: "Pills",
	segmented: "Segmented",
};
const LOOK_OPTIONS = TABS_LOOKS.map((value) => ({ value, label: LOOK_LABELS[value] }));

/** Tabs settings: how the tab bar looks, whether each tab has its own link, and adding a tab. Titles and content are edited per tab. */
export function TabsSettings({ block, onUpdate }: TabsSettingsProps) {
	const { content, updateContent } = useSettingsState<TabsContent>({ block, onUpdate, parseContent: readTabsContent });
	const tabs = (block.children ?? []).filter((child) => child.name === TAB_BLOCK_NAME);

	const addTab = () => {
		const tab = buildTab({ parentId: block.id, title: `Tab ${tabs.length + 1}` });
		if (tab) onUpdate?.({ children: [...(block.children ?? []), tab] });
	};

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Tabs" icon={PanelTop} defaultOpen>
				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-npb-text-secondary">
							{tabs.length} {tabs.length === 1 ? "tab" : "tabs"}
						</p>
						<Button type="button" variant="outline" size="sm" onClick={addTab} className="gap-1">
							<Plus className="h-3.5 w-3.5" aria-hidden />
							Add tab
						</Button>
					</div>
					<SettingsChipGroup
						label="Look"
						options={LOOK_OPTIONS}
						value={content.look}
						onChange={(value) => updateContent({ look: readTabsContent({ kind: "structured", data: { look: value } }).look })}
					/>
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<SettingsLabel htmlFor={`tabs-linkable-${block.id}`}>Link to each tab</SettingsLabel>
							<p className="npb-settings-hint-muted text-xs">
								Each tab gets its own link, like #pnpm at the end of the page address, so readers can share the tab they are on.
							</p>
						</div>
						<Switch
							id={`tabs-linkable-${block.id}`}
							checked={content.linkable}
							onCheckedChange={(checked) => updateContent({ linkable: checked })}
						/>
					</div>
					<p className="npb-settings-hint-muted text-xs">
						Click a tab on the canvas to select it, rename it and fill it with blocks.
					</p>
				</div>
			</CollapsibleCard>
		</div>
	);
}
