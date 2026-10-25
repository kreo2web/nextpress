import React, { useState } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { List } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Textarea } from "@/components/ui/textarea";
import {
	DEFAULT_DOCS_LIST_CONTENT,
	DOCS_LIST_STYLES,
	listFromLines,
	listToLines,
	readDocsListContent,
	type DocsListContent,
	type DocsListStyle,
} from "@shared/blocks/docs-list-model";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";

type DocsListSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const STYLE_LABELS: Record<DocsListStyle, string> = { bullet: "Bullets", number: "Numbers", check: "Checklist" };
const STYLE_OPTIONS = DOCS_LIST_STYLES.map((value) => ({ value, label: STYLE_LABELS[value] }));

/** List settings: bullets, numbers or a checklist, and the items one per line (two spaces start a nested item). */
export function DocsListSettings({ block, onUpdate }: DocsListSettingsProps) {
	const { content, updateContent } = useSettingsState<DocsListContent>({
		block,
		onUpdate,
		defaultContent: DEFAULT_DOCS_LIST_CONTENT,
		parseContent: (raw) => readDocsListContent(raw),
	});
	// The field keeps what was typed (a blank line from Enter) until it loses focus.
	const [draft, setDraft] = useState<string | null>(null);

	return (
		<div className="space-y-4">
			<CollapsibleCard title="List" icon={List} defaultOpen>
				<div className="space-y-4">
					<SettingsChipGroup
						label="Style"
						ariaLabel="List style"
						options={STYLE_OPTIONS}
						value={content.style}
						onChange={(value) => {
							const style = DOCS_LIST_STYLES.find((option) => option === value) ?? "bullet";
							updateContent({ style, items: listFromLines({ style, lines: listToLines(content) }) });
						}}
					/>
					<div className="space-y-2">
						<SettingsLabel htmlFor="docs-list-items">Items (one per line)</SettingsLabel>
						<Textarea
							id="docs-list-items"
							className="h-36"
							value={draft ?? listToLines(content)}
							onFocus={() => setDraft(listToLines(content))}
							onBlur={() => setDraft(null)}
							onChange={(event) => {
								setDraft(event.target.value);
								updateContent({ items: listFromLines({ style: content.style, lines: event.target.value }) });
							}}
						/>
						<p className="text-xs text-npb-text-muted">
							Start a line with two spaces to nest it under the item above.{content.style === "check" ? " Start with [ ] or [x] to tick it." : ""}
						</p>
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
