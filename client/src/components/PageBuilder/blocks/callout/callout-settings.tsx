import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { MessageSquareWarning } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { CALLOUT_TYPES, DEFAULT_CALLOUT_CONTENT, readCalloutContent, readCalloutType, type CalloutContent } from "@shared/blocks/callout-model";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";

type CalloutSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const TYPE_LABELS: Record<CalloutContent["type"], string> = {
	note: "Note",
	tip: "Tip",
	warning: "Warning",
	danger: "Danger",
	success: "Success",
};
const TYPE_OPTIONS = CALLOUT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

/** Callout settings: what kind of note it is and an optional bold title. The text is edited on the canvas. */
export function CalloutSettings({ block, onUpdate }: CalloutSettingsProps) {
	const { content, updateContent } = useSettingsState<CalloutContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_CALLOUT_CONTENT,
		parseContent: (raw) => readCalloutContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Callout" icon={MessageSquareWarning} defaultOpen>
				<div className="space-y-4">
					<SettingsChipGroup label="Type" options={TYPE_OPTIONS} value={content.type} onChange={(value) => updateContent({ type: readCalloutType(value) })} />
					<div>
						<SettingsLabel htmlFor="callout-title">Title</SettingsLabel>
						<Input
							id="callout-title"
							className="mt-1 h-9"
							value={content.title}
							placeholder="Optional, shown in bold"
							onChange={(event) => updateContent({ title: event.target.value })}
						/>
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
