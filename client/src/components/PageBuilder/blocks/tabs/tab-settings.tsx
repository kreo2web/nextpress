import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { readTabContent, type TabContent } from "@shared/blocks/tabs-model";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type TabSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** One tab: the title on the tab bar. Its content is edited on the canvas. */
export function TabSettings({ block, onUpdate }: TabSettingsProps) {
	const { content, updateContent } = useSettingsState<TabContent>({ block, onUpdate, parseContent: readTabContent });
	return (
		<SettingsSection>
			<div className="space-y-2">
				<SettingsLabel htmlFor={`tab-title-${block.id}`}>Title</SettingsLabel>
				<Input
					id={`tab-title-${block.id}`}
					value={content.title}
					onChange={(event) => updateContent({ title: event.target.value })}
					placeholder="Tab title"
				/>
			</div>
		</SettingsSection>
	);
}
