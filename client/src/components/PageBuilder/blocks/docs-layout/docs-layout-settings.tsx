import React, { useMemo } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { PanelLeft } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { readDocsLayoutContent, type DocsLayoutContent } from "@shared/blocks/docs-layout-model";
import { SettingsLabel } from "../../shared";
import { useSettingsState } from "../useSettingsState";
import { useSiteDocsPages } from "./use-site-docs-pages";

type DocsLayoutSettingsProps = {
	block: BlockConfig;
	onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/** A Select can't hold an empty value, so "Top of this section" travels as this word. */
const TOP_OF_SECTION = "__top";

type FlagKey = "showToc" | "showPrevNext" | "showBreadcrumbs" | "copyPage";
const FLAGS: { key: FlagKey; label: string }[] = [
	{ key: "showToc", label: "On this page" },
	{ key: "showPrevNext", label: "Previous and next" },
	{ key: "showBreadcrumbs", label: "Breadcrumbs" },
	{ key: "copyPage", label: "Copy page buttons" },
];

/** Docs layout settings: where the sidebar starts, and which extras show. The content is edited on the canvas. */
export function DocsLayoutSettings({ block, onUpdate }: DocsLayoutSettingsProps) {
	const { content, updateContent } = useSettingsState<DocsLayoutContent>({ block, onUpdate, parseContent: readDocsLayoutContent });
	const { pages } = useSiteDocsPages();
	const options = useMemo(() => [...pages].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")), [pages]);
	const known = options.some((page) => page.id === content.rootPageId);

	return (
		<div className="space-y-4">
			<CollapsibleCard title="Docs layout" icon={PanelLeft} defaultOpen>
				<div className="space-y-4">
					<div className="space-y-2">
						<SettingsLabel htmlFor={`docs-root-${block.id}`}>Root page</SettingsLabel>
						<Select
							value={content.rootPageId && known ? content.rootPageId : TOP_OF_SECTION}
							onValueChange={(value) => updateContent({ rootPageId: value === TOP_OF_SECTION ? "" : value })}
						>
							<SelectTrigger className="h-9" id={`docs-root-${block.id}`} aria-label="Root page">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={TOP_OF_SECTION}>Top of this section</SelectItem>
								{options.map((page) => (
									<SelectItem key={page.id} value={page.id}>
										{page.title?.trim() || "Untitled"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="npb-settings-hint-muted text-xs">The sidebar lists this page and the pages under it. Set a page's parent to move it in.</p>
					</div>
					<div className="space-y-3">
						{FLAGS.map(({ key, label }) => (
							<div key={key} className="flex items-center justify-between">
								<SettingsLabel htmlFor={`docs-${key}-${block.id}`}>{label}</SettingsLabel>
								<Switch id={`docs-${key}-${block.id}`} checked={content[key]} onCheckedChange={(checked) => updateContent({ [key]: checked })} />
							</div>
						))}
					</div>
				</div>
			</CollapsibleCard>
		</div>
	);
}
