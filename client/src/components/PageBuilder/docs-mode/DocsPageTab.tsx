import { useId, type ReactElement } from "react";
import { DEFAULT_DOCS_FEATURES } from "@shared/blocks/docs-shell-model";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRequiredDocsMode } from "./docs-mode-context";
import { InlineAction, PanelField, SwitchRow } from "./docs-page-tab-parts";
import type { DocsPageToggleKey } from "./docs-types";

/** What a page may be: the three states a docs page is switched between from here. */
const STATUS_OPTIONS = [
	{ value: "draft", label: "Draft" },
	{ value: "publish", label: "Published" },
	{ value: "private", label: "Private" },
] as const;

/** A page's address part: lowercase letters, numbers and dashes, as the server keeps it. */
export const toAddressPart = (value: string): string =>
	value
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");

const PAGE_SWITCHES: ReadonlyArray<{ key: DocsPageToggleKey; label: string; feature: "toc" | "prevNext" | "copyPage" }> = [
	{ key: "showToc", label: "On this page", feature: "toc" },
	{ key: "showPrevNext", label: "Previous and next", feature: "prevNext" },
	{ key: "copyPage", label: "Copy page", feature: "copyPage" },
];

/**
 * The Page tab: this page's own title, description, address and status, which parts show around
 * its text, and whether it is left out of the sidebar. Everything here is part of the page, so it
 * is kept with the page's Save like any other edit.
 */
export function DocsPageTab(): ReactElement {
	const { meta, setMeta, editor, toggles, setToggle, settings, addressPrefix, isHome, panel } = useRequiredDocsMode();
	const { draft, setDraft } = editor;
	const ids = { title: useId(), description: useId(), address: useId(), status: useId() };
	const features = settings?.features ?? DEFAULT_DOCS_FEATURES;

	return (
		<div className="flex flex-col">
			<div className="space-y-4 px-4 py-4">
				<PanelField label="Title" htmlFor={ids.title}>
					<Input id={ids.title} value={meta.title} onChange={(event) => setMeta({ title: event.target.value })} />
				</PanelField>
				<PanelField label="Description" htmlFor={ids.description} hint="Shown under the title, in search results and when the page is shared.">
					<Textarea id={ids.description} rows={3} value={draft.description} onChange={(event) => setDraft({ description: event.target.value })} />
				</PanelField>
				<PanelField label="Address" htmlFor={ids.address}>
					<div className="flex min-w-0">
						<span className="flex max-w-[55%] shrink-0 items-center truncate rounded-l-[var(--npb-radius-input)] border border-r-0 border-npb-border-strong bg-npb-surface-inset px-2.5 font-mono text-xs text-npb-text-muted" title={addressPrefix}>
							{addressPrefix}
						</span>
						<Input id={ids.address} className="rounded-l-none" value={meta.slug} onChange={(event) => setMeta({ slug: toAddressPart(event.target.value) })} />
					</div>
				</PanelField>
				<div className="flex items-center justify-between gap-3">
					<Label htmlFor={ids.status} className="text-sm font-medium text-npb-text-secondary">
						Status
					</Label>
					<Select value={meta.status} onValueChange={(status) => setMeta({ status })}>
						<SelectTrigger id={ids.status} className="h-8 w-36" aria-label="Status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<CollapsibleCard title="This page shows" defaultOpen>
				{PAGE_SWITCHES.map(({ key, label, feature }) => {
					const docsOn = features[feature];
					return (
						<SwitchRow
							key={key}
							label={label}
							checked={docsOn && toggles[key]}
							disabled={!docsOn}
							onChange={(on) => setToggle(key, on)}
							hint={
								docsOn ? undefined : (
									<>
										Turned off for the whole docs. <InlineAction onClick={() => panel.openSection("features")}>Change it in Docs</InlineAction>.
									</>
								)
							}
						/>
					);
				})}
			</CollapsibleCard>
			<div className="border-t border-npb-divider px-4 py-4">
				<SwitchRow
					label="Hide from sidebar"
					checked={draft.hidden}
					disabled={isHome}
					onChange={(hidden) => setDraft({ hidden })}
					hint={isHome ? "The docs home always shows in the sidebar." : "The page still opens from its address."}
				/>
			</div>
		</div>
	);
}
