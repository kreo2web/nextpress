import React from "react";
import type { BlockConfig, TokenEntry } from "@shared/schema-types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSettingsState } from "../useSettingsState";
import { DimensionPresetField } from "../../dimension-preset-field";
import { SettingsDisclosure, SettingsLabel, SettingsSection } from "../../shared";
import { FillField } from "../../fill/fill-field";
import { PAGE_FONT_CATALOG } from "@shared/font-catalog";
import { PAGE_SIDE_PADDING_PRESETS, PAGE_TOP_BOTTOM_PADDING_PRESETS } from "@shared/dimension-presets";
import { resolveShellPadding } from "@shared/page-shell-padding";
import { SpacingField } from "../../spacing-field";
import { spacingPairsPatch } from "../../spacing-styles";
import { PageShellScrollbarField } from "./page-shell-scrollbar-field";
import { SettingsChipGroup } from "../../settings-chip-group";
import { isFullPageColumn } from "@shared/page-shell-styles";
import {
	DEFAULT_PAGE_SHELL_CONTENT,
	PAGE_CONTENT_ALIGN_OPTIONS,
	PAGE_SHELL_WIDTH_OPTIONS,
	readPageShellContent,
	type PageShellContent,
} from "./page-shell-model";

/**
 * The page's look: font, width, padding, colors. One group, so no accordion — the block's name
 * ("Page shell") is already the title above the tabs.
 */
export function PageShellSettings({
	block,
	onUpdate,
}: {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
	const { content, updateContent } = useSettingsState<PageShellContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_PAGE_SHELL_CONTENT,
		parseContent: readPageShellContent,
	});

	const pageSides = resolveShellPadding(content);

	return (
		<SettingsSection>
			<div className="space-y-2">
				<SettingsLabel htmlFor="page-shell-font">Font</SettingsLabel>
				<Select
					value={content.fontFamily}
					onValueChange={(value) => updateContent({ fontFamily: value })}
				>
					<SelectTrigger id="page-shell-font" className="npb-settings-select-trigger">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PAGE_FONT_CATALOG.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<DimensionPresetField
				label="Content width"
				presets={PAGE_SHELL_WIDTH_OPTIONS}
				value={content.containerWidth}
				defaultValue={DEFAULT_PAGE_SHELL_CONTENT.containerWidth}
				customPlaceholder="e.g. 1100px or 80rem"
				onChange={(next) =>
					updateContent({ containerWidth: next ?? DEFAULT_PAGE_SHELL_CONTENT.containerWidth })
				}
			/>
			{isFullPageColumn(content.containerWidth) ? null : (
				<SettingsChipGroup
					label="Content position"
					ariaLabel="Content position"
					options={[...PAGE_CONTENT_ALIGN_OPTIONS]}
					value={content.contentAlign ?? "center"}
					onChange={(value) => {
						if (value === "left" || value === "center" || value === "right") {
							updateContent({ contentAlign: value });
						}
					}}
				/>
			)}
			<SpacingField
				ariaLabel="Page padding"
				title=""
				sideModes={["pairs"]}
				pairLabels={{ horizontal: "Side padding", vertical: "Top and bottom padding" }}
				pairPresets={{ horizontal: PAGE_SIDE_PADDING_PRESETS, vertical: PAGE_TOP_BOTTOM_PADDING_PRESETS }}
				targets={[{ kind: "padding", sides: pageSides, defaultSides: resolveShellPadding(DEFAULT_PAGE_SHELL_CONTENT) }]}
				onCommit={(patch) => updateContent(spacingPairsPatch({ sides: pageSides, patch }))}
			/>
			<div className="space-y-2">
				<SettingsLabel>Colors</SettingsLabel>
				<FillField
					ariaLabel="Page color"
					defaultProperty="backgroundColor"
					targets={[
						{
							property: "backgroundColor",
							label: "Background",
							entry: content.backgroundColor,
							styleValue: content.backgroundColor?.style,
							fill: content.backgroundFill,
						},
						{
							property: "color",
							label: "Text",
							entry: content.textColor,
							styleValue: content.textColor?.style,
							// Text stays a plain colour: a page-wide text fill would paint every word as one huge gradient.
							fillKinds: [],
						},
					]}
					onColorChange={(entry: TokenEntry) =>
						updateContent(
							entry.property === "color" ? { textColor: entry } : { backgroundColor: entry },
						)
					}
					onFillChange={(_target, fill) => updateContent({ backgroundFill: fill })}
					onTheme={(target) =>
						updateContent(
							target.property === "color" ? { textColor: undefined } : { backgroundColor: undefined },
						)
					}
				/>
			</div>
			<SettingsDisclosure
				title="Scrollbar"
				defaultOpen={content.scrollbar?.look === "custom" || content.scrollbar?.look === "hidden"}
			>
				<PageShellScrollbarField
					value={content.scrollbar}
					onChange={(next) => updateContent({ scrollbar: next })}
				/>
			</SettingsDisclosure>
		</SettingsSection>
	);
}
