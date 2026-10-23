import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { ListOrdered, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { STEP_BLOCK_NAME, readStepsContent, type StepsContent } from "@shared/blocks/steps-model";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";
import { buildStep } from "./steps-factory";

const LAYOUT_OPTIONS = [
	{ value: "vertical", label: "Down the page" },
	{ value: "horizontal", label: "In a row" },
];
const MARKER_OPTIONS = [
	{ value: "number", label: "Numbers" },
	{ value: "dot", label: "Dots" },
];

type StepsSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Steps settings: how the steps are laid out, the marker, and adding a step. Text is edited on the canvas. */
export function StepsSettings({ block, onUpdate }: StepsSettingsProps) {
	const { content, updateContent } = useSettingsState<StepsContent>({
		block,
		onUpdate,
		parseContent: readStepsContent,
	});
	const count = (block.children ?? []).filter((child) => child.name === STEP_BLOCK_NAME).length;

	const addStep = () => {
		const step = buildStep({ parentId: block.id, title: `Step ${count + 1}` });
		if (step) onUpdate?.({ children: [...(block.children ?? []), step] });
	};

	return (
		<CollapsibleCard title="Steps" icon={ListOrdered} defaultOpen>
			<div className="space-y-4">
				<div className="flex items-center justify-between gap-3">
					<p className="text-sm text-npb-text-secondary">
						{count} {count === 1 ? "step" : "steps"}
					</p>
					<Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1">
						<Plus className="h-3.5 w-3.5" aria-hidden />
						Add step
					</Button>
				</div>
				<SettingsChipGroup
					label="Layout"
					options={LAYOUT_OPTIONS}
					value={content.layout}
					onChange={(value) => updateContent({ layout: value === "horizontal" ? "horizontal" : "vertical" })}
				/>
				{content.layout === "horizontal" ? (
					<p className="npb-settings-hint-muted text-xs">On phones the steps stack down the page.</p>
				) : null}
				<SettingsChipGroup
					label="Marker"
					options={MARKER_OPTIONS}
					value={content.marker}
					onChange={(value) => updateContent({ marker: value === "dot" ? "dot" : "number" })}
				/>
			</div>
		</CollapsibleCard>
	);
}
