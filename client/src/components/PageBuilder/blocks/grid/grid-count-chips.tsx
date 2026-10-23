import React from "react";
import { SettingsLabel } from "../../shared";
import { linkTargetChipClass } from "../shared/link-settings";

type CountChipsProps = {
	label: string;
	max: number;
	value: number;
	disabled?: boolean;
	/** Why the chips are off, shown under them so a dead control is never silent. */
	disabledReason?: string;
	onChange: (count: number) => void;
};

/** A row of 1..max number chips. `SettingsChipGroup` has no disabled state, and these need one. */
export function CountChips({ label, max, value, disabled = false, disabledReason, onChange }: CountChipsProps) {
	const counts = Array.from({ length: max }, (_, index) => index + 1);
	return (
		<div className="space-y-2">
			<SettingsLabel>{label}</SettingsLabel>
			<div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
				{counts.map((count) => (
					<button
						key={count}
						type="button"
						role="radio"
						aria-checked={value === count}
						disabled={disabled}
						title={disabled ? disabledReason : undefined}
						onClick={() => onChange(count)}
						className={`h-8 rounded-md text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${linkTargetChipClass(value === count)}`}
					>
						{count}
					</button>
				))}
			</div>
			{disabled && disabledReason ? <p className="npb-settings-hint-muted text-xs">{disabledReason}</p> : null}
		</div>
	);
}
