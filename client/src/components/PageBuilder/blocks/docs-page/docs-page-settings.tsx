import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Switch } from "@/components/ui/switch";
import { readDocsPageContent, type DocsPageContent } from "@shared/blocks/docs-page-model";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";

type FlagKey = keyof DocsPageContent;
const FLAGS: { key: FlagKey; label: string }[] = [
	{ key: "showTitle", label: "Page title" },
	{ key: "showDescription", label: "Page description" },
	{ key: "showBreadcrumbs", label: "Breadcrumbs" },
	{ key: "showToc", label: "On this page" },
	{ key: "showPrevNext", label: "Previous and next" },
	{ key: "copyPage", label: "Copy page buttons" },
];

/** Docs page settings: which parts show around the content. The title and description are the page's own (Page settings). */
export function DocsPageSettings({ block, onUpdate }: { block: BlockConfig; onUpdate?: (updates: Partial<BlockConfig>) => void }) {
	const { content, updateContent } = useSettingsState<DocsPageContent>({ block, onUpdate, parseContent: readDocsPageContent });
	return (
		<SettingsSection>
			{FLAGS.map(({ key, label }) => (
				<div key={key} className="flex items-center justify-between">
					<SettingsLabel htmlFor={`docs-page-${key}-${block.id}`}>{label}</SettingsLabel>
					<Switch id={`docs-page-${key}-${block.id}`} checked={content[key]} onCheckedChange={(checked) => updateContent({ [key]: checked })} />
				</div>
			))}
			<p className="text-xs text-muted-foreground">The title is this page's title, and the description is its search description.</p>
		</SettingsSection>
	);
}
