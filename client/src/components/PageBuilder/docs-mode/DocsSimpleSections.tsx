import { useId, type ReactElement } from "react";
import { Link } from "wouter";
import type { DocsFeatures } from "@shared/blocks/docs-shell-model";
import type { DocsSettings, UpdateDocsSettingsInput } from "@shared/docs";
import { Input } from "@/components/ui/input";
import { pageEditorPath } from "@/lib/admin-content-routes";
import { CommitInput } from "./docs-commit-input";
import { PanelField, SwitchRow } from "./docs-page-tab-parts";

type SaveProps = { settings: DocsSettings; save: (patch: UpdateDocsSettingsInput) => void; live: boolean };

/** Search: on or off, and the words in its box and on its button. It covers these docs only. */
export function DocsSearchSection({ settings, save, live }: SaveProps): ReactElement {
	const ids = { placeholder: useId(), label: useId() };
	return (
		<div className="space-y-4">
			<SwitchRow label="Search" checked={settings.search.show} onChange={(show) => save({ search: { show } })} hint="Visitors can search these docs from the top bar, or with Ctrl K." />
			{settings.search.show ? (
				<>
					<PanelField label="Text in the search box" htmlFor={ids.placeholder}>
						<CommitInput id={ids.placeholder} value={settings.search.placeholder} live={live} placeholder="Search the docs" onCommit={(placeholder) => save({ search: { placeholder } })} />
					</PanelField>
					<PanelField label="Text on the search button" htmlFor={ids.label} hint="Search covers these docs only.">
						<CommitInput id={ids.label} value={settings.search.label} live={live} placeholder="Search" onCommit={(label) => save({ search: { label } })} />
					</PanelField>
				</>
			) : null}
		</div>
	);
}

const FEATURES: ReadonlyArray<{ key: keyof DocsFeatures; label: string; hint: string }> = [
	{ key: "sidebar", label: "Sidebar", hint: "The list of pages on the left." },
	{ key: "toc", label: "On this page", hint: "The list of headings beside the text." },
	{ key: "prevNext", label: "Previous and next", hint: "Links to the pages before and after." },
	{ key: "copyPage", label: "Copy page", hint: "Buttons that copy the page as text, or open it as markdown." },
];

/** The parts every page of the docs can have. A page can still turn one off for itself in its Page tab. */
export function DocsFeaturesSection({ settings, save }: Omit<SaveProps, "live">): ReactElement {
	return (
		<div className="space-y-4">
			{FEATURES.map(({ key, label, hint }) => (
				<SwitchRow key={key} label={label} hint={hint} checked={settings.features[key]} onChange={(on) => save({ features: { [key]: on } })} />
			))}
		</div>
	);
}

/** Where the docs live: the home page's address. Changing it is a change to that page, so it points there. */
export function DocsAddressSection({ path, homeId, isHome }: { path: string; homeId: string; isHome: boolean }): ReactElement {
	const id = useId();
	return (
		<div className="space-y-2">
			<PanelField label="Address of the docs" htmlFor={id} hint="The docs open at this address, and every page below it.">
				<Input id={id} readOnly value={path} className="font-mono text-xs" />
			</PanelField>
			<p className="text-xs text-npb-text-muted">
				{isHome ? "Change it in the Page tab." : (
					<>
						To change it, open the{" "}
						<Link href={pageEditorPath(homeId)} className="font-medium text-npb-text-secondary underline underline-offset-2 hover:text-npb-text-primary">
							docs home page
						</Link>
						.
					</>
				)}
			</p>
		</div>
	);
}
