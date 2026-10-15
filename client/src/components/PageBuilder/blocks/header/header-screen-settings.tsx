import { SettingsChipGroup } from "../../settings-chip-group";
import { slotsForHeaderVariant, type HeaderContent } from "@shared/header-model";
import { readScreenShow, SCREEN_SHOW_OPTIONS, type ScreenShow } from "@shared/screen-show";

/**
 * Which screen each header piece is on. Hiding the name or the button on a phone
 * keeps them from sitting on top of each other.
 */
export function HeaderScreenSettings({
	content,
	onChange,
}: {
	content: HeaderContent;
	onChange: (patch: Partial<HeaderContent>) => void;
}) {
	const slots = slotsForHeaderVariant(content.variant);
	const pick = (key: "brandShowOn" | "navShowOn" | "actionsShowOn" | "blocksShowOn") => (value: string) => {
		onChange({ [key]: readScreenShow(value) });
	};

	return (
		<div className="mt-4 space-y-4">
			<p className="npb-settings-hint-muted text-xs">
				Choose Desktop or Mobile when the name and the button crowd a phone. The tablet preview follows Desktop.
			</p>
			<SettingsChipGroup
				label="Name"
				options={chipOptions()}
				value={content.brandShowOn ?? "all"}
				onChange={pick("brandShowOn")}
			/>
			{slots.showNav ? (
				<>
					<SettingsChipGroup
						label="Links"
						options={chipOptions()}
						value={content.navShowOn ?? "all"}
						onChange={pick("navShowOn")}
					/>
					<SettingsChipGroup
						label="On a phone"
						options={[
							{ value: "menu", label: "Menu" },
							{ value: "links", label: "Links" },
						]}
						value={content.navPhoneMenu === false ? "links" : "menu"}
						onChange={(value) => onChange({ navPhoneMenu: value !== "links" })}
					/>
					<p className="npb-settings-hint-muted -mt-2 text-xs">
						Menu hides the links behind a button. Links keeps them in the bar.
					</p>
				</>
			) : null}
			{slots.showActions ? (
				<SettingsChipGroup
					label="Buttons"
					options={chipOptions()}
					value={content.actionsShowOn ?? "all"}
					onChange={pick("actionsShowOn")}
				/>
			) : null}
			{slots.showBlocks ? (
				<SettingsChipGroup
					label="Right side"
					options={chipOptions()}
					value={content.blocksShowOn ?? "all"}
					onChange={pick("blocksShowOn")}
				/>
			) : null}
		</div>
	);
}

const chipOptions = (): { value: ScreenShow; label: string }[] =>
	SCREEN_SHOW_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
