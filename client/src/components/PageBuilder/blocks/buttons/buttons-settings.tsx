import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsDisclosure, SettingsLabel, SettingsSection } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { LinkTargetChips } from "../shared/link-settings";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsState } from "../useSettingsState";
import ColorField from "../../ColorField";
import {
	BUTTON_SIZE_PRESETS,
	type ButtonLook,
	type ButtonSize,
} from "@shared/button-look";
import {
	buttonsItemFollowsTheme,
	readButtonsItemLook,
	readButtonsItemSize,
	THEME_BUTTON_FILL,
	THEME_BUTTON_TEXT,
	type ButtonsItemLook,
} from "@shared/buttons-item-look";

export type ButtonItem = {
	id: string;
	text: string;
	url: string;
	linkTarget?: "_self" | "_blank";
	rel?: string;
	title?: string;
	className?: string;
} & ButtonsItemLook;

export type ButtonsLayout = "flex-start" | "center" | "flex-end" | "space-between";
export type ButtonsOrientation = "horizontal" | "vertical";

export type ButtonsData = {
	buttons?: ButtonItem[];
	layout?: ButtonsLayout;
	orientation?: ButtonsOrientation;
	className?: string;
};

const BUTTONS_LAYOUT_OPTIONS = [
	{ value: "flex-start", label: "Left" },
	{ value: "center", label: "Center" },
	{ value: "flex-end", label: "Right" },
	{ value: "space-between", label: "Space between", accessibleName: "Space between" },
] as const;

const BUTTONS_ORIENTATION_OPTIONS = [
	{ value: "horizontal", label: "Row" },
	{ value: "vertical", label: "Stack" },
] as const;

function isButtonsLayout(value: string): value is ButtonsLayout {
	return (
		value === "flex-start" ||
		value === "center" ||
		value === "flex-end" ||
		value === "space-between"
	);
}

function isButtonsOrientation(value: string): value is ButtonsOrientation {
	return value === "horizontal" || value === "vertical";
}

function isButtonLook(value: string): value is ButtonLook {
	return value === "solid" || value === "ghost";
}

function isButtonSize(value: string): value is ButtonSize {
	return value === "sm" || value === "md" || value === "lg" || value === "xl";
}

function hasItemLook(button: ButtonItem): boolean {
	return Boolean(
		button.look ||
			button.size ||
			button.backgroundColor ||
			button.color ||
			button.borderRadius,
	);
}

export const DEFAULT_DATA: ButtonsData = {
	buttons: [
		{
			id: "btn-1",
			text: "Click Me",
			url: "#",
			linkTarget: "_self",
			rel: "",
			title: "",
			className: "",
		},
	],
	layout: "flex-start",
	orientation: "horizontal",
	className: "",
};

export function ButtonsSettings({
	block,
	onUpdate,
}: {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
	const { content: buttonsData, updateContent } = useSettingsState<ButtonsData>({
		block,
		onUpdate,
		defaultContent: DEFAULT_DATA,
	});

	const buttons: ButtonItem[] = Array.isArray(buttonsData?.buttons) ? buttonsData.buttons : [];

	const updateButtons = (next: ButtonItem[]) => {
		updateContent({ buttons: next });
	};

	const addButton = () => {
		updateButtons([
			...buttons,
			{
				id: `btn-${Date.now()}`,
				text: "Button",
				url: "#",
				linkTarget: "_self",
				rel: "",
				title: "",
				className: "",
			},
		]);
	};

	const updateButton = (index: number, updates: Partial<ButtonItem>) => {
		updateButtons(buttons.map((btn, i) => (i === index ? { ...btn, ...updates } : btn)));
	};

	return (
		<SettingsSection>
			<div className="flex justify-between items-center">
				<SettingsLabel>Buttons</SettingsLabel>
				<Button type="button" variant="outline" size="sm" onClick={addButton}>
					<Plus className="w-4 h-4 mr-1" />
					Add Button
				</Button>
			</div>

			<div className="divide-y divide-npb-border-default">
				{buttons.map((button, index) => {
					const look = readButtonsItemLook(button.look);
					const size = readButtonsItemSize(button.size);
					return (
						<div key={button.id || index} className="space-y-3 py-4 first:pt-0 last:pb-0">
							<div className="flex justify-between items-center">
								<SettingsLabel>Button {index + 1}</SettingsLabel>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-9 w-9 shrink-0 p-0"
									aria-label={`Remove button ${index + 1}`}
									onClick={() => updateButtons(buttons.filter((_, i) => i !== index))}
								>
									<Trash2 className="w-4 h-4" />
								</Button>
							</div>

							<div>
								<SettingsLabel htmlFor={`btn-text-${index}`}>Button Text</SettingsLabel>
								<Input
									id={`btn-text-${index}`}
									value={button.text}
									onChange={(e) => updateButton(index, { text: e.target.value })}
									placeholder="Button text"
									className="mt-1 h-9"
								/>
							</div>

							<div>
								<SettingsLabel htmlFor={`btn-url-${index}`}>URL</SettingsLabel>
								<Input
									id={`btn-url-${index}`}
									value={button.url}
									onChange={(e) => updateButton(index, { url: e.target.value })}
									placeholder="https://example.com"
									className="mt-1 h-9"
								/>
							</div>

							<LinkTargetChips
								value={button.linkTarget}
								onChange={({ target }) => updateButton(index, { linkTarget: target })}
							/>

							<SettingsDisclosure title="Look" defaultOpen={hasItemLook(button)}>
								<SettingsChipGroup
									label="Look"
									ariaLabel={`Button ${index + 1} look`}
									options={[
										{ value: "solid", label: "Solid", accessibleName: "Solid button" },
										{ value: "ghost", label: "Ghost", accessibleName: "Ghost button" },
									]}
									value={look}
									onChange={(value) => {
										if (isButtonLook(value)) updateButton(index, { look: value });
									}}
								/>
								<SettingsChipGroup
									label="Size"
									ariaLabel={`Button ${index + 1} size`}
									options={BUTTON_SIZE_PRESETS.map((preset) => ({
										value: preset.value,
										label: preset.label,
									}))}
									value={size}
									onChange={(value) => {
										if (isButtonSize(value)) updateButton(index, { size: value });
									}}
								/>
								<div className="space-y-2">
									<SettingsLabel>Colors</SettingsLabel>
									<ColorField
										ariaLabel={`Button ${index + 1} color`}
										defaultProperty={look === "solid" ? "backgroundColor" : "color"}
										targets={[
											{
												property: "backgroundColor",
												label: look === "ghost" ? "Outline" : "Background",
												styleValue: button.backgroundColor,
												followsTheme: buttonsItemFollowsTheme({
													property: "backgroundColor",
													look,
													backgroundColor: button.backgroundColor,
													color: button.color,
												}),
											},
											{
												property: "color",
												label: "Text",
												styleValue: button.color,
												followsTheme: buttonsItemFollowsTheme({
													property: "color",
													look,
													backgroundColor: button.backgroundColor,
													color: button.color,
												}),
											},
										]}
										onChange={(entry) => {
											const css = entry.style?.trim();
											if (entry.property === "color") {
												updateButton(index, { color: css || undefined });
												return;
											}
											updateButton(index, { backgroundColor: css || undefined });
										}}
										onTheme={(target) => {
											if (target.property === "color") {
												updateButton(index, {
													color: look === "ghost" ? THEME_BUTTON_FILL : THEME_BUTTON_TEXT,
												});
												return;
											}
											updateButton(index, { backgroundColor: THEME_BUTTON_FILL });
										}}
									/>
								</div>
							</SettingsDisclosure>
						</div>
					);
				})}
			</div>

			<SettingsChipGroup
				label="Alignment"
				options={[...BUTTONS_LAYOUT_OPTIONS]}
				value={buttonsData?.layout || "flex-start"}
				onChange={(value) => {
					if (!isButtonsLayout(value)) return;
					updateContent({ layout: value });
				}}
			/>

			<SettingsChipGroup
				label="Direction"
				options={[...BUTTONS_ORIENTATION_OPTIONS]}
				value={buttonsData?.orientation || "horizontal"}
				onChange={(value) => {
					if (!isButtonsOrientation(value)) return;
					updateContent({ orientation: value });
				}}
			/>
		</SettingsSection>
	);
}
