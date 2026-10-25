import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { History } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { DEFAULT_UPDATE_CONTENT, readUpdateContent, type UpdateContent } from "@shared/blocks/update-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type UpdateSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Changelog entry settings: the label (a date or version) and one short line under it. The notes are edited on the canvas. */
export function UpdateSettings({ block, onUpdate }: UpdateSettingsProps) {
	const { content, updateContent } = useSettingsState<UpdateContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_UPDATE_CONTENT,
		parseContent: (raw) => readUpdateContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Entry" icon={History} defaultOpen>
				<div className="space-y-4">
					<div>
						<SettingsLabel htmlFor={`update-label-${block.id}`}>Label</SettingsLabel>
						<Input
							id={`update-label-${block.id}`}
							className="mt-1 h-9"
							value={content.label}
							placeholder="October 2026 or v1.4.2"
							onChange={(event) => updateContent({ label: event.target.value })}
						/>
						<p className="npb-settings-hint-muted mt-1 text-xs">Shown beside the entry, and listed under On this page.</p>
					</div>
					<div>
						<SettingsLabel htmlFor={`update-description-${block.id}`}>Description</SettingsLabel>
						<Input
							id={`update-description-${block.id}`}
							className="mt-1 h-9"
							value={content.description}
							placeholder="Optional, one short line"
							onChange={(event) => updateContent({ description: event.target.value })}
						/>
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
