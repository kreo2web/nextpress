import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { SquareCode } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
	CODE_EXAMPLE_LAYOUTS,
	DEFAULT_CODE_EXAMPLE_CONTENT,
	readCodeExampleContent,
	type CodeExampleContent,
} from "@shared/blocks/code-example-model";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";

type CodeExampleSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const LAYOUT_LABELS: Record<CodeExampleContent["layout"], string> = { side: "Side by side", stacked: "Stacked" };
const LAYOUT_OPTIONS = CODE_EXAMPLE_LAYOUTS.map((value) => ({ value, label: LAYOUT_LABELS[value] }));

/** Code example settings: how the code and the result sit. The blocks inside are edited on the canvas. */
export function CodeExampleSettings({ block, onUpdate }: CodeExampleSettingsProps) {
	const { content, updateContent } = useSettingsState<CodeExampleContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_CODE_EXAMPLE_CONTENT,
		parseContent: (raw) => readCodeExampleContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Example" icon={SquareCode} defaultOpen>
				<div className="space-y-4">
					<SettingsChipGroup
						label="Layout"
						options={LAYOUT_OPTIONS}
						value={content.layout}
						onChange={(value) => updateContent({ layout: readCodeExampleContent({ kind: "structured", data: { layout: value } }).layout })}
					/>
					<p className="npb-settings-hint-muted text-xs">
						The first block is the code. Every block after it is the result. On phones they always stack.
					</p>
				</div>
			</CollapsibleCard>
		</div>
	);
}
