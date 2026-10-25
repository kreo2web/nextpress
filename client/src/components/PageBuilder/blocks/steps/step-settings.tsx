import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import {
	STEPS_BLOCK_NAME,
	readStepContent,
	readStepIcon,
	readStepsContent,
	type StepContent,
	type StepIcon,
} from "@shared/blocks/steps-model";
import { formatIconReferenceLabel, type IconReference } from "@/lib/icon-indexes";
import { IconPickerButton } from "../../IconPicker/IconPickerButton";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useBlockAccessor } from "../blockStateRegistry";
import { IconRenderer } from "../shared/IconRenderer";
import { useSettingsState } from "../useSettingsState";

type StepSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** The step's icon in the picker's own shape (the picker reads sizes and colours from it). */
const toPickerIcon = (icon: StepIcon): IconReference => ({
	iconSet: icon.iconSet,
	iconName: icon.iconName,
	size: icon.size ?? 24,
	color: icon.color ?? "currentColor",
	strokeWidth: icon.strokeWidth ?? 2,
	...(icon.svg ? { svg: icon.svg } : {}),
	...(icon.url ? { url: icon.url } : {}),
	...(icon.label ? { label: icon.label } : {}),
	...(icon.tint ? { tint: true } : {}),
});

/**
 * A picked icon as a whole replacement. Saving merges into what is saved, so the drawing,
 * picture or tint of the previous pick must be cleared with null, or a brand logo could be
 * painted as a one-colour stencil left over from an upload.
 */
const replaceIcon = (picked: IconReference): StepIcon => {
	const next = readStepIcon(picked);
	return { ...next, svg: next.svg ?? null, url: next.url ?? null, label: next.label ?? null, tint: next.tint ?? null };
};

/**
 * One step: its title, and its icon when the Steps around it use the "icon" marker (the number
 * and dot markers need nothing). The explanation is blocks inside the step, edited on the canvas.
 */
export function StepSettings({ block, onUpdate }: StepSettingsProps) {
	const { content, updateContent } = useSettingsState<StepContent>({
		block,
		onUpdate,
		parseContent: readStepContent,
	});
	const parent = useBlockAccessor(block.parentId ?? undefined)?.getFullState();
	const marker = parent?.name === STEPS_BLOCK_NAME ? readStepsContent(parent.content).marker : "number";
	const current = toPickerIcon(content.icon);
	const iconLabel = formatIconReferenceLabel(current);

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
				{marker === "icon" ? (
					<div className="space-y-2">
						<SettingsLabel>Icon</SettingsLabel>
						<div className="flex min-w-0 items-center gap-3">
							<div className="npb-settings-well flex h-10 w-10 shrink-0 items-center justify-center rounded-none border p-0">
								<IconRenderer icon={current} size={20} />
							</div>
							<p className="npb-settings-hint-muted min-w-0 flex-1 truncate text-xs" title={iconLabel}>
								{iconLabel}
							</p>
							<IconPickerButton
								className="shrink-0"
								currentIcon={current}
								onSelect={(picked) => updateContent({ icon: replaceIcon(picked) })}
							/>
						</div>
					</div>
				) : null}
				<p className="npb-settings-hint-muted text-xs">
					{marker === "number"
						? "The number follows the step's place in the list. Add text, images or buttons inside the step on the canvas."
						: "Add text, images or buttons inside the step on the canvas."}
				</p>
			</div>
		</SettingsSection>
	);
}
