import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Workflow } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_DIAGRAM_CONTENT, readDiagramContent, type DiagramContent } from "@shared/blocks/diagram-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type DiagramSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Diagram settings: the Mermaid text in a monospace box, and an optional caption under the picture. */
export function DiagramSettings({ block, onUpdate }: DiagramSettingsProps) {
	const { content, updateContent } = useSettingsState<DiagramContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_DIAGRAM_CONTENT,
		parseContent: (raw) => readDiagramContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Diagram" icon={Workflow} defaultOpen>
				<div className="space-y-4">
					<div className="space-y-2">
						<SettingsLabel htmlFor={`diagram-code-${block.id}`}>Mermaid code</SettingsLabel>
						<Textarea
							id={`diagram-code-${block.id}`}
							value={content.code}
							rows={10}
							spellCheck={false}
							aria-describedby={`diagram-code-hint-${block.id}`}
							className="font-mono text-xs"
							onChange={(event) => updateContent({ code: event.target.value })}
						/>
						<p id={`diagram-code-hint-${block.id}`} className="npb-settings-hint-muted text-xs">
							Flowcharts, sequence diagrams and more, in Mermaid syntax. The picture updates as you type.
						</p>
					</div>
					<div>
						<SettingsLabel htmlFor={`diagram-caption-${block.id}`}>Caption</SettingsLabel>
						<Input
							id={`diagram-caption-${block.id}`}
							className="mt-1 h-9"
							value={content.caption}
							placeholder="Optional, shown under the picture"
							onChange={(event) => updateContent({ caption: event.target.value })}
						/>
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
