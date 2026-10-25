import { useId, type ReactElement } from "react";
import type { DocsSettings, UpdateDocsSettingsInput } from "@shared/docs";
import { Button } from "@/components/ui/button";
import { MediaUrlField } from "../blocks/shared/media-url-field";
import { CommitInput } from "./docs-commit-input";
import { DocsLinksField } from "./DocsLinksField";
import { PanelField, SwitchRow } from "./docs-page-tab-parts";

type Props = {
	settings: DocsSettings;
	save: (patch: UpdateDocsSettingsInput) => void;
	/** See `CommitInput`: true on the docs home, where each edit is local and cheap. */
	live: boolean;
};

/**
 * The top bar: logo (one for light pages, one for dark), name, up to six links, one button and the
 * search box. The "light and dark switch" the mockup shows is left out: the published frame has no
 * such switch, and a setting for something that isn't there would do nothing.
 */
export function DocsHeaderSection({ settings, save, live }: Props): ReactElement {
	const ids = { title: useId(), button: useId(), buttonUrl: useId(), placeholder: useId() };
	return (
		<div className="space-y-4">
			<MediaUrlField
				id="docs-logo"
				label="Logo"
				kind="image"
				value={settings.logoUrl}
				placeholder="https://"
				onChange={({ url }) => save({ logoUrl: url })}
				onLibrarySelect={({ item }) => save({ logoUrl: item.url })}
			/>
			<div className="space-y-2">
				<MediaUrlField
					id="docs-logo-dark"
					label="Logo for dark pages"
					kind="image"
					value={settings.logoDarkUrl}
					placeholder="Same as the logo above"
					onChange={({ url }) => save({ logoDarkUrl: url })}
					onLibrarySelect={({ item }) => save({ logoDarkUrl: item.url })}
				/>
				{settings.logoDarkUrl ? (
					<Button type="button" variant="ghost" size="sm" onClick={() => save({ logoDarkUrl: "" })}>
						Use the logo above on dark pages too
					</Button>
				) : null}
			</div>
			<PanelField label="Title" htmlFor={ids.title} hint="Shown next to the logo. Empty uses the home page's title.">
				<CommitInput id={ids.title} value={settings.title} live={live} onCommit={(title) => save({ title })} />
			</PanelField>
			<DocsLinksField links={settings.links} live={live} onChange={(links) => save({ links })} />
			<div className="space-y-1.5">
				<span className="text-sm font-medium text-npb-text-secondary">Button</span>
				<div className="grid grid-cols-2 gap-2">
					<CommitInput id={ids.button} ariaLabel="Button text" placeholder="Get started" value={settings.button.label} live={live} onCommit={(label) => save({ button: { label, url: settings.button.url } })} />
					<CommitInput id={ids.buttonUrl} ariaLabel="Button address" placeholder="/docs/quickstart" value={settings.button.url} live={live} onCommit={(url) => save({ button: { label: settings.button.label, url } })} />
				</div>
				<p className="npb-settings-hint-muted text-xs">The button shows when it has both a name and an address.</p>
			</div>
			<SwitchRow label="Search box" checked={settings.search.show} onChange={(show) => save({ search: { show } })} />
			{settings.search.show ? (
				<PanelField label="Search box text" htmlFor={ids.placeholder}>
					<CommitInput id={ids.placeholder} value={settings.search.placeholder} live={live} placeholder="Search the docs" onCommit={(placeholder) => save({ search: { placeholder } })} />
				</PanelField>
			) : null}
		</div>
	);
}
