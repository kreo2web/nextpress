import React from "react";
import { GRID_MAX_SPANS, type GridContent, type GridSpan } from "@shared/blocks/grid-model";
import {
	GRID_LAYOUTS,
	GRID_LAYOUT_LABELS,
	GRID_SIZE_CHOICES,
	GRID_SIZE_LABELS,
	buildLayoutSpans,
	choiceOf,
	explainChoiceBlocked,
	explainLayoutBlocked,
	matchLayout,
	spanAt,
	spanForChoice,
	withSpanAt,
	type GridLayout,
	type GridSizeChoice,
} from "@shared/blocks/grid-layouts";
import { SettingsLabel } from "../../shared";
import { linkTargetChipClass } from "../shared/link-settings";

type Chip = { value: string; label: string; reason: string | null };

type ChipRowProps = {
	label: string;
	chips: Chip[];
	selected: string | null;
	columns: number;
	onPick: (value: string) => void;
};

/** A row of radio chips where each chip can be off with its own reason. `SettingsChipGroup` has no disabled state. */
function ChipRow({ label, chips, selected, columns, onPick }: ChipRowProps) {
	return (
		<div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
			{chips.map((chip) => (
				<button
					key={chip.value}
					type="button"
					role="radio"
					aria-checked={selected === chip.value}
					aria-label={chip.label}
					disabled={chip.reason !== null}
					title={chip.reason ?? undefined}
					onClick={() => onPick(chip.value)}
					className={`h-8 min-w-0 rounded-md px-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${linkTargetChipClass(selected === chip.value)}`}
				>
					{chip.label}
				</button>
			))}
		</div>
	);
}

/** The distinct reasons, once each, as the note under a group of chips. */
function ReasonNote({ reasons }: { reasons: (string | null)[] }) {
	const distinct = [...new Set(reasons.filter((reason): reason is string => reason !== null))];
	if (distinct.length === 0) return null;
	return <p className="npb-settings-hint-muted text-xs">{distinct.join(" ")}</p>;
}

type GridSizeSettingsProps = {
	content: GridContent;
	itemCount: number;
	onChange: (spans: GridSpan[]) => void;
};

/**
 * Bento sizes: a few whole layouts to start from, then a size for each item. Choosing a layout
 * fills the list; the list can then be changed item by item, which leaves no layout chosen.
 */
export function GridSizeSettings({ content, itemCount, onChange }: GridSizeSettingsProps) {
	const shown = Math.min(itemCount, GRID_MAX_SPANS);
	const layoutChips: Chip[] = GRID_LAYOUTS.map((layout) => ({
		value: layout,
		label: GRID_LAYOUT_LABELS[layout],
		reason: explainLayoutBlocked({ layout, content }),
	}));
	const sizeReasons = (choice: GridSizeChoice) =>
		content.minItemWidth !== "" ? "Items are fitting by width, so sizes are off." : explainChoiceBlocked({ choice, columns: content.columns });
	const sizeChips: Chip[] = GRID_SIZE_CHOICES.map((choice) => ({ value: choice, label: GRID_SIZE_LABELS[choice], reason: sizeReasons(choice) }));

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<SettingsLabel>Layout</SettingsLabel>
				<ChipRow
					label="Layout"
					chips={layoutChips}
					columns={2}
					selected={matchLayout({ spans: content.spans, itemCount })}
					onPick={(layout) => onChange(buildLayoutSpans({ layout: layout as GridLayout, itemCount }))}
				/>
				<ReasonNote reasons={layoutChips.map((chip) => chip.reason)} />
			</div>
			<div className="space-y-3">
				<SettingsLabel>Item sizes</SettingsLabel>
				{shown === 0 ? <p className="npb-settings-hint-muted text-xs">Add items to the grid to size them.</p> : null}
				{Array.from({ length: shown }, (_, index) => (
					<div key={index} className="space-y-1.5">
						<SettingsLabel className="text-xs">{`Item ${index + 1}`}</SettingsLabel>
						<ChipRow
							label={`Item ${index + 1} size`}
							chips={sizeChips}
							columns={3}
							selected={choiceOf({ span: spanAt({ spans: content.spans, index }), columns: content.columns })}
							onPick={(choice) => onChange(withSpanAt({ spans: content.spans, index, span: spanForChoice({ choice: choice as GridSizeChoice, columns: content.columns }) }))}
						/>
					</div>
				))}
				<ReasonNote reasons={sizeChips.map((chip) => chip.reason)} />
				{itemCount > GRID_MAX_SPANS ? <p className="npb-settings-hint-muted text-xs">Only the first {GRID_MAX_SPANS} items can have their own size.</p> : null}
			</div>
		</div>
	);
}
