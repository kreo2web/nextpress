import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Heading2 } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import {
	DEFAULT_DOCS_HEADING_CONTENT,
	DOCS_HEADING_LEVELS,
	readDocsHeadingContent,
	readDocsHeadingLevel,
	type DocsHeadingContent,
} from "@shared/blocks/docs-heading-model";
import { docsHeadingAnchor } from "@shared/blocks/docs-heading-id";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";

type DocsHeadingSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const LEVEL_OPTIONS = DOCS_HEADING_LEVELS.map((level) => ({ value: String(level), label: `H${level}` }));

/** Heading settings: its level and words, and the link address it gets. */
export function DocsHeadingSettings({ block, onUpdate }: DocsHeadingSettingsProps) {
	const { content, updateContent } = useSettingsState<DocsHeadingContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_DOCS_HEADING_CONTENT,
		parseContent: (raw) => readDocsHeadingContent(raw),
	});

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Heading" icon={Heading2} defaultOpen>
				<div className="space-y-4">
					<SettingsChipGroup
						label="Level"
						ariaLabel="Heading level"
						options={LEVEL_OPTIONS}
						value={String(content.level)}
						onChange={(value) => updateContent({ level: readDocsHeadingLevel(value) })}
					/>
					<div>
						<SettingsLabel htmlFor="docs-heading-text">Text</SettingsLabel>
						<Input id="docs-heading-text" className="mt-1 h-9" value={content.text} onChange={(event) => updateContent({ text: event.target.value })} />
						</div>
					<div>
						<SettingsLabel htmlFor="docs-heading-anchor">Link id</SettingsLabel>
						<Input
							id="docs-heading-anchor"
							className="mt-1 h-9"
							value={content.anchor}
							placeholder={docsHeadingAnchor({ text: content.text, anchor: "" })}
							onChange={(event) => updateContent({ anchor: event.target.value })}
						/>
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
