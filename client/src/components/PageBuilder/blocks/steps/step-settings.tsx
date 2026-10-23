import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { readStepContent, type StepContent } from "@shared/blocks/steps-model";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type StepSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** One step: its title. The explanation is blocks inside the step, edited on the canvas. */
export function StepSettings({ block, onUpdate }: StepSettingsProps) {
	const { content, updateContent } = useSettingsState<StepContent>({
		block,
		onUpdate,
		parseContent: readStepContent,
	});
	return (
		<SettingsSection>
			<div className="space-y-4">
				<div className="space-y-2">
					<SettingsLabel htmlFor={`step-title-${block.id}`}>Title</SettingsLabel>
					<Input
						id={`step-title-${block.id}`}
						value={content.title}
						onChange={(event) => updateContent({ title: event.target.value })}
						placeholder="What happens in this step"
					/>
				</div>
				<p className="npb-settings-hint-muted text-xs">
					The number follows the step's place in the list. Add text, images or buttons inside the step on the canvas.
				</p>
			</div>
		</SettingsSection>
	);
}
