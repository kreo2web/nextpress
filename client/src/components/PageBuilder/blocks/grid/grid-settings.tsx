import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Columns3, X } from "lucide-react";
import { readGridContent, type GridAlign, type GridContent } from "@shared/blocks/grid-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";
import { CountChips } from "./grid-count-chips";

const ALIGN_OPTIONS = [
	{ value: "stretch", label: "Stretch" },
	{ value: "start", label: "Top" },
	{ value: "center", label: "Middle" },
];
const MIN_WIDTH_PRESETS = ["200px", "240px", "280px", "320px"];
const FIT_REASON = "Items are fitting by width, so the counts are off. Clear the width to set them.";

type GridSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Grid settings: how many across at each screen size, or fit by width, and how items line up. */
export function GridSettings({ block, onUpdate }: GridSettingsProps) {
	const { content, updateContent } = useSettingsState<GridContent>({ block, onUpdate, parseContent: readGridContent });
	const fitting = content.minItemWidth !== "";

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Columns" icon={Columns3} defaultOpen>
				<div className="space-y-4">
					<CountChips label="Columns" max={6} value={content.columns} disabled={fitting} disabledReason={FIT_REASON} onChange={(columns) => updateContent({ columns })} />
					<CountChips label="Tablet" max={6} value={content.tabletColumns} disabled={fitting} onChange={(tabletColumns) => updateContent({ tabletColumns })} />
					<CountChips label="Phone" max={3} value={content.phoneColumns} disabled={fitting} onChange={(phoneColumns) => updateContent({ phoneColumns })} />
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<SettingsLabel htmlFor={`grid-fit-${block.id}`}>Fit by width</SettingsLabel>
							{fitting ? (
								<Button type="button" variant="ghost" size="sm" className="h-7 gap-1" onClick={() => updateContent({ minItemWidth: "" })}>
									<X className="h-3.5 w-3.5" aria-hidden />
									Clear
								</Button>
							) : null}
						</div>
						<Input
							id={`grid-fit-${block.id}`}
							className="h-9"
							value={content.minItemWidth}
							placeholder="e.g. 240px"
							onChange={(event) => updateContent({ minItemWidth: event.target.value.trim() })}
						/>
						<div className="grid grid-cols-4 gap-2">
							{MIN_WIDTH_PRESETS.map((preset) => (
								<Button key={preset} type="button" size="sm" variant={content.minItemWidth === preset ? "default" : "outline"} className="h-8 px-0 text-xs" onClick={() => updateContent({ minItemWidth: preset })}>
									{preset}
								</Button>
							))}
						</div>
						<p className="npb-settings-hint-muted text-xs">Each item gets at least this width and as many fit as there is room for, at every screen size.</p>
					</div>
				</div>
			</CollapsibleCard>
			<CollapsibleCard title="Items" icon={Columns3} defaultOpen={false}>
				<SettingsChipGroup label="Line up" options={ALIGN_OPTIONS} value={content.align} onChange={(value) => updateContent({ align: value as GridAlign })} />
			</CollapsibleCard>
		</div>
	);
}
