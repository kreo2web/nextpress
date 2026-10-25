import React, { useMemo } from "react";
import { Link } from "wouter";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { readDocsShellContent, type DocsShellContent } from "@shared/blocks/docs-shell-model";
import { usePageContext } from "../../PageContext";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";
import { useSiteDocsPages } from "../docs-layout/use-site-docs-pages";
import { DocsShellLinksField } from "./docs-shell-links-field";
import { useRootShell } from "./use-root-shell";

/** A Select can't hold an empty value, so "Top of this section" travels as this word. */
const TOP_OF_SECTION = "__top";

type Props = { block: BlockConfig; onUpdate?: (updates: Partial<BlockConfig>) => void };

/**
 * Docs shell settings. Set once on the docs home page; every other page keeps "Use the home
 * page's settings" on and this panel just says where they come from, with a link there.
 */
export function DocsShellSettings({ block, onUpdate }: Props) {
	const { content, updateContent } = useSettingsState<DocsShellContent>({ block, onUpdate, parseContent: readDocsShellContent });
	const { pageId } = usePageContext();
	const { pages } = useSiteDocsPages();
	const { root } = useRootShell({ pages, pageId: pageId ?? "" });
	const options = useMemo(() => [...pages].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")), [pages]);
	const known = options.some((page) => page.id === content.rootPageId);
	const inherited = content.inherit && Boolean(root);

	return (
		<SettingsSection>
			{root ? (
				<div className="flex items-center justify-between gap-3">
					<SettingsLabel htmlFor={`docs-shell-inherit-${block.id}`}>Use the docs home page's settings</SettingsLabel>
					<Switch id={`docs-shell-inherit-${block.id}`} checked={content.inherit} onCheckedChange={(checked) => updateContent({ inherit: checked })} />
				</div>
			) : (
				<p className="text-xs text-muted-foreground">This is the docs home page. Other docs pages use these settings unless they switch it off.</p>
			)}
			{inherited && root ? (
				<p className="text-sm text-muted-foreground">
					The top bar, links and search come from{" "}
					<Link href={`/admin/page-builder/page/${root.id}`} className="font-medium text-foreground underline underline-offset-2">
						{root.title}
					</Link>
					. Change them there to update every docs page.
				</p>
			) : (
				<>
					<div className="space-y-2">
						<SettingsLabel htmlFor={`docs-shell-title-${block.id}`}>Name in the top bar</SettingsLabel>
						<Input id={`docs-shell-title-${block.id}`} className="h-9" value={content.title} placeholder="The home page's title" onChange={(event) => updateContent({ title: event.target.value })} />
					</div>
					<div className="space-y-2">
						<SettingsLabel htmlFor={`docs-shell-logo-${block.id}`}>Logo address</SettingsLabel>
						<Input id={`docs-shell-logo-${block.id}`} className="h-9" value={content.logoUrl} placeholder="https://" onChange={(event) => updateContent({ logoUrl: event.target.value })} />
					</div>
					<div className="space-y-2">
						<SettingsLabel htmlFor={`docs-shell-root-${block.id}`}>Sidebar starts at</SettingsLabel>
						<Select value={content.rootPageId && known ? content.rootPageId : TOP_OF_SECTION} onValueChange={(value) => updateContent({ rootPageId: value === TOP_OF_SECTION ? "" : value })}>
							<SelectTrigger className="h-9" id={`docs-shell-root-${block.id}`} aria-label="Sidebar starts at">
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
						<p className="text-xs text-muted-foreground">The sidebar lists this page and the pages under it. Set a page's parent to move it in.</p>
					</div>
					<DocsShellLinksField blockId={block.id} links={content.links} onChange={(links) => updateContent({ links })} />
					<div className="flex items-center justify-between">
						<SettingsLabel htmlFor={`docs-shell-search-${block.id}`}>Search button</SettingsLabel>
						<Switch id={`docs-shell-search-${block.id}`} checked={content.search.show} onCheckedChange={(show) => updateContent({ search: { ...content.search, show } })} />
					</div>
					{content.search.show ? (
						<>
							<div className="space-y-2">
								<SettingsLabel htmlFor={`docs-shell-search-label-${block.id}`}>Button text</SettingsLabel>
								<Input id={`docs-shell-search-label-${block.id}`} className="h-9" value={content.search.label} placeholder="Search" onChange={(event) => updateContent({ search: { ...content.search, label: event.target.value } })} />
							</div>
							<div className="space-y-2">
								<SettingsLabel htmlFor={`docs-shell-search-hint-${block.id}`}>Hint in the search box</SettingsLabel>
								<Input id={`docs-shell-search-hint-${block.id}`} className="h-9" value={content.search.placeholder} placeholder="Search the docs" onChange={(event) => updateContent({ search: { ...content.search, placeholder: event.target.value } })} />
							</div>
						</>
					) : null}
				</>
			)}
		</SettingsSection>
	);
}
