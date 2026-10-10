import type { JSX } from "react";
import {
	DEFAULT_HEADER_CONTENT_WIDTH,
	DEFAULT_HEADER_PADDING_BLOCK,
	DEFAULT_HEADER_PADDING_INLINE,
	HEADER_CONTENT_WIDTH_PRESETS,
	HEADER_SIDE_PADDING_PRESETS,
	HEADER_TOP_BOTTOM_PADDING_PRESETS,
	type HeaderSpacing,
} from "@shared/header-spacing";
import { DimensionPresetField } from "../../dimension-preset-field";
import { SpacingField } from "../../spacing-field";
import { spacingPairsPatch, type SpacingSideQuad } from "../../spacing-styles";

type HeaderSpacingSettingsProps = {
	value: HeaderSpacing;
	/** `undefined` for a field puts its default back. */
	onChange: (patch: HeaderSpacing) => void;
};

/** The header's padding as four sides: top and bottom from one key, left and right from the other. */
function headerSides(spacing: HeaderSpacing): SpacingSideQuad {
	const block = spacing.paddingBlock ?? DEFAULT_HEADER_PADDING_BLOCK;
	const inline = spacing.paddingInline ?? DEFAULT_HEADER_PADDING_INLINE;
	return { top: block, bottom: block, left: inline, right: inline };
}

/** Header padding and how wide its row of logo, links and buttons may get. */
export function HeaderSpacingSettings({ value, onChange }: HeaderSpacingSettingsProps): JSX.Element {
	const sides = headerSides(value);
	return (
		<div className="space-y-4">
			<DimensionPresetField
				label="Content width"
				presets={HEADER_CONTENT_WIDTH_PRESETS}
				value={value.contentWidth ?? DEFAULT_HEADER_CONTENT_WIDTH}
				defaultValue={DEFAULT_HEADER_CONTENT_WIDTH}
				customPlaceholder="e.g. 1240px"
				onChange={(next) => onChange({ contentWidth: next })}
			/>
			<p className="npb-settings-hint-muted -mt-2 text-xs">
				The background stays edge to edge. The logo, links and buttons sit within this width, centred.
			</p>
			<SpacingField
				ariaLabel="Header padding"
				title=""
				sideModes={["pairs"]}
				pairLabels={{ horizontal: "Side padding", vertical: "Top and bottom padding" }}
				pairPresets={{ horizontal: HEADER_SIDE_PADDING_PRESETS, vertical: HEADER_TOP_BOTTOM_PADDING_PRESETS }}
				targets={[{ kind: "padding", sides, defaultSides: headerSides({}) }]}
				onCommit={(patch) => onChange(spacingPairsPatch({ sides, patch }))}
			/>
		</div>
	);
}
