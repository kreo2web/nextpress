import { useState, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SPACING_PRESETS, type DimensionPreset } from "@shared/dimension-presets";
import { DimensionPresetField } from "./dimension-preset-field";
import { SettingsChipGroup } from "./settings-chip-group";
import { SettingsLabel } from "./shared";
import {
	hasSpacingSide,
	pickSideMode,
	sideKey,
	spacingPairValue,
	spacingPatchForAll,
	spacingPatchForPair,
	spacingSidesMatch,
	type SpacingAxis,
	type SpacingKind,
	type SpacingPatch,
	type SpacingSide,
	type SpacingSideMode,
	type SpacingSideQuad,
} from "./spacing-styles";

/** One property the control edits. Padding is the space inside a box, margin the space outside it. */
export type SpacingTarget = {
	kind: SpacingKind;
	/** Name on the toggle, the heading and the field labels. Defaults to "Padding" or "Margin". */
	label?: string;
	/** The four sides as saved now. */
	sides: SpacingSideQuad;
	/** What Reset puts back. Leave out and Reset clears the sides. */
	defaultSides?: SpacingSideQuad;
};

export type SpacingFieldProps = {
	/** One target shows just that property. Two (padding and margin) add a toggle, like ColorField's targets. */
	targets: readonly SpacingTarget[];
	/** Receives the sides an edit changed. A `null` clears that side. */
	onCommit: (patch: SpacingPatch) => void;
	/** Ways of setting sides, in display order. Defaults to all three. One mode hides the choice. */
	sideModes?: readonly SpacingSideMode[];
	/** Preset chips for "All sides" and "Each side". Defaults to the shared spacing scale. */
	presets?: readonly DimensionPreset[];
	/** Preset chips for each pair in "In pairs" mode, for blocks whose pairs use their own scale. */
	pairPresets?: { horizontal: readonly DimensionPreset[]; vertical: readonly DimensionPreset[] };
	/** Labels for the two pair fields. */
	pairLabels?: { horizontal: string; vertical: string };
	/** Adds an Auto chip to margin, which centres a block. Padding never gets it, since `auto` is not valid padding. */
	allowAuto?: boolean;
	/** Heading above the control. Defaults to the one target's name. Pass "" to leave it out. */
	title?: string;
	/** Accessible name for the whole control. */
	ariaLabel?: string;
	/** Says which property is hovered, so the canvas can highlight padding or margin. */
	onHoverArea?: (area: SpacingKind | null) => void;
};

const ALL_MODES: readonly SpacingSideMode[] = ["all", "pairs", "each"];
const MODE_LABELS: Record<SpacingSideMode, string> = { all: "All sides", pairs: "In pairs", each: "Each side" };
const SIDE_ORDER: readonly SpacingSide[] = ["top", "right", "bottom", "left"];
const SIDE_LABELS: Record<SpacingSide, string> = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" };
const KIND_LABELS: Record<SpacingKind, string> = { padding: "Padding", margin: "Margin" };
const DEFAULT_PAIR_LABELS = { horizontal: "Left and right", vertical: "Top and bottom" };
const PAIR_SIDES: Record<SpacingAxis, readonly [SpacingSide, SpacingSide]> = {
	horizontal: ["left", "right"],
	vertical: ["top", "bottom"],
};
const AUTO_PRESET: DimensionPreset = { value: "auto", label: "Auto" };

/** Opens on the property that already holds values, so a saved margin is never hidden behind padding. */
function startingKind(targets: readonly SpacingTarget[]): SpacingKind {
	return targets.find((item) => hasSpacingSide(item.sides))?.kind ?? targets[0]?.kind ?? "padding";
}

/**
 * Padding or margin in one control, for any block that sets box spacing: preset chips first, then the
 * shared `[ Custom | value | unit ▾ ]` group. Sides are all together, in pairs, or one at a time.
 *
 * WHY: every spacing control in the builder should read and behave the same, so a block only says which
 * properties it has and which ways of setting sides make sense for it.
 */
export function SpacingField({
	targets,
	onCommit,
	sideModes = ALL_MODES,
	presets = SPACING_PRESETS,
	pairPresets,
	pairLabels = DEFAULT_PAIR_LABELS,
	allowAuto = false,
	title,
	ariaLabel = "Spacing",
	onHoverArea,
}: SpacingFieldProps): JSX.Element | null {
	const [activeKind, setActiveKind] = useState<SpacingKind>(() => startingKind(targets));
	const [modes, setModes] = useState<Partial<Record<SpacingKind, SpacingSideMode>>>(() =>
		Object.fromEntries(
			targets.map((item) => [item.kind, pickSideMode({ sides: item.sides, allowed: sideModes })]),
		),
	);
	const [side, setSide] = useState<SpacingSide>("top");

	const target = targets.find((item) => item.kind === activeKind) ?? targets[0];
	if (!target) return null;

	const { kind, sides, defaultSides } = target;
	const name = target.label ?? KIND_LABELS[kind];
	const mode = modes[kind] ?? sideModes[0] ?? "all";
	const heading = title ?? name;
	const showToggle = targets.length > 1;
	const showHeading = !showToggle && heading !== "";
	const canReset = SIDE_ORDER.some((item) => sides[item] !== (defaultSides?.[item] ?? ""));
	// Negative margins pull a block over its neighbour and are valid CSS. Negative padding is not, so it is refused.
	const allowNegative = kind === "margin";
	const withAuto = (list: readonly DimensionPreset[]): readonly DimensionPreset[] =>
		allowAuto && kind === "margin" && !list.some((preset) => preset.value === "auto")
			? [...list, AUTO_PRESET]
			: list;
	const sidePresets = withAuto(presets);

	const chooseMode = (next: SpacingSideMode) => setModes((prev) => ({ ...prev, [kind]: next }));

	/** Reset writes only the sides that differ from the default, so untouched sides keep their saved form. */
	const resetPatch = (): SpacingPatch => {
		const patch: SpacingPatch = {};
		SIDE_ORDER.forEach((item) => {
			const wanted = defaultSides?.[item] ?? "";
			if (sides[item] !== wanted) patch[sideKey(kind, item)] = wanted === "" ? null : wanted;
		});
		return patch;
	};

	return (
		<div
			className="space-y-3"
			role="group"
			aria-label={ariaLabel}
			onMouseEnter={() => onHoverArea?.(kind)}
			onMouseLeave={() => onHoverArea?.(null)}
		>
			{showToggle || showHeading || canReset ? (
				<div className="flex flex-wrap items-center justify-between gap-2">
					{showToggle ? (
						<div className="flex items-stretch" role="group" aria-label="Padding or margin">
							{targets.map((item, index) => (
								<button
									key={item.kind}
									type="button"
									aria-pressed={item.kind === kind}
									onClick={() => setActiveKind(item.kind)}
									className={cn(
										"npb-settings-chip flex items-center px-3 focus:outline-none",
										index > 0 && "-ml-px",
										item.kind === kind && "npb-settings-chip--active",
									)}
								>
									{item.label ?? KIND_LABELS[item.kind]}
								</button>
							))}
						</div>
					) : showHeading ? (
						<SettingsLabel>{heading}</SettingsLabel>
					) : (
						<span />
					)}
					{canReset ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="-my-0.5 h-6 px-2 text-xs"
							aria-label={`Reset ${name}`}
							onClick={() => onCommit(resetPatch())}
						>
							Reset
						</Button>
					) : null}
				</div>
			) : null}

			{sideModes.length > 1 ? (
				<SettingsChipGroup
					label=""
					ariaLabel={`${name} sides`}
					options={sideModes.map((option) => ({ value: option, label: MODE_LABELS[option] }))}
					value={mode}
					onChange={(next) => chooseMode(next as SpacingSideMode)}
				/>
			) : null}

			{mode === "all" ? (
				<DimensionPresetField
					ariaLabel={name}
					showReset={false}
					allowNegative={allowNegative}
					presets={sidePresets}
					value={spacingSidesMatch(sides) && sides.top ? sides.top : undefined}
					onChange={(next) => onCommit(spacingPatchForAll({ kind, value: next }))}
				/>
			) : mode === "pairs" ? (
				<div className="space-y-3">
					{(["horizontal", "vertical"] as const).map((axis: SpacingAxis) => {
						const [first, second] = PAIR_SIDES[axis];
						return (
							<DimensionPresetField
								key={axis}
								label={pairLabels[axis]}
								showReset={false}
								allowNegative={allowNegative}
								presets={withAuto(pairPresets?.[axis] ?? presets)}
								value={spacingPairValue(sides[first], sides[second])}
								onChange={(next) => onCommit(spacingPatchForPair({ kind, axis, value: next }))}
							/>
						);
					})}
				</div>
			) : (
				<div className="space-y-3">
					<SettingsChipGroup
						label=""
						ariaLabel={`${name} side`}
						options={SIDE_ORDER.map((item) => ({ value: item, label: SIDE_LABELS[item] }))}
						value={side}
						onChange={(next) => setSide(next as SpacingSide)}
					/>
					<DimensionPresetField
						ariaLabel={`${name} ${SIDE_LABELS[side].toLowerCase()}`}
						showReset={false}
						allowNegative={allowNegative}
						presets={sidePresets}
						value={sides[side] || undefined}
						onChange={(next) => onCommit({ [sideKey(kind, side)]: next ?? null })}
					/>
				</div>
			)}
		</div>
	);
}
