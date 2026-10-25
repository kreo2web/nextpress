import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Heading, Link2, Palette } from "lucide-react";
import { CARD_LOOKS, readCardContent, type CardContent, type CardLook } from "@shared/blocks/card-model";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { PopupLinkPicker } from "../../popup-links";
import { useSettingsState } from "../useSettingsState";

const LOOK_LABELS: Record<CardLook, string> = { bordered: "Border", raised: "Raised", subtle: "Soft", plain: "Plain" };
const LOOK_OPTIONS = CARD_LOOKS.map((look) => ({ value: look, label: LOOK_LABELS[look] }));

type CardSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** Card settings: the look, and an optional link that makes the whole card clickable. */
export function CardSettings({ block, onUpdate }: CardSettingsProps) {
	const { content, updateContent } = useSettingsState<CardContent>({ block, onUpdate, parseContent: readCardContent });
	const linked = content.link !== "";

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Heading" icon={Heading} defaultOpen={content.title !== ""}>
				<div>
					<SettingsLabel htmlFor={`card-title-${block.id}`}>Heading</SettingsLabel>
					<Input
						id={`card-title-${block.id}`}
						className="mt-1 h-9"
						value={content.title}
						placeholder="Optional, shown at the top of the card"
						onChange={(event) => updateContent({ title: event.target.value })}
					/>
				</div>
			</CollapsibleCard>
			<CollapsibleCard title="Look" icon={Palette} defaultOpen>
				<SettingsChipGroup label="Look" options={LOOK_OPTIONS} value={content.look} onChange={(value) => updateContent({ look: value as CardLook })} />
			</CollapsibleCard>
			<CollapsibleCard title="Link" icon={Link2} defaultOpen={linked}>
				<div className="space-y-4">
					<div>
						<SettingsLabel htmlFor={`card-link-${block.id}`}>Link</SettingsLabel>
						<Input
							id={`card-link-${block.id}`}
							className="mt-1 h-9"
							value={content.link}
							placeholder="https://example.com"
							onChange={(event) => updateContent({ link: event.target.value })}
						/>
						<PopupLinkPicker id={`card-popup-${block.id}`} value={content.link} onChange={(link) => updateContent({ link })} />
						<p className="npb-settings-hint-muted mt-1 text-xs">Makes the whole card clickable. Buttons inside keep their own links.</p>
					</div>
					{linked ? (
						<div>
							<SettingsLabel htmlFor={`card-link-label-${block.id}`}>Link label</SettingsLabel>
							<Input
								id={`card-link-label-${block.id}`}
								className="mt-1 h-9"
								value={content.linkLabel}
								placeholder="Read the pricing guide"
								onChange={(event) => updateContent({ linkLabel: event.target.value })}
							/>
							<p className="npb-settings-hint-muted mt-1 text-xs">What a screen reader says for the card.</p>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-3">
						<SettingsLabel htmlFor={`card-new-tab-${block.id}`}>Open in new tab</SettingsLabel>
						<Switch
							id={`card-new-tab-${block.id}`}
							checked={content.linkTarget === "_blank"}
							disabled={!linked}
							onCheckedChange={(checked) => updateContent({ linkTarget: checked ? "_blank" : "_self" })}
						/>
					</div>
					{!linked ? <p className="npb-settings-hint-muted -mt-2 text-xs">Add a link first to choose where it opens.</p> : null}
				</div>
			</CollapsibleCard>
		</div>
	);
}
