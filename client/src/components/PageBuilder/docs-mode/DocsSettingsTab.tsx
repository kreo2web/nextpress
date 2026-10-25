import type { ReactElement, ReactNode } from "react";
import type { UpdateDocsSettingsInput } from "@shared/docs";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { DocsHeaderSection } from "./DocsHeaderSection";
import { DocsNavigationSection } from "./DocsNavigationSection";
import { DocsAddressSection, DocsFeaturesSection, DocsSearchSection } from "./DocsSimpleSections";
import { useRequiredDocsMode } from "./docs-mode-context";
import type { DocsSection } from "./docs-types";

const SECTION_TITLES: ReadonlyArray<{ id: DocsSection; title: string }> = [
	{ id: "header", title: "Header" },
	{ id: "navigation", title: "Navigation" },
	{ id: "search", title: "Search" },
	{ id: "features", title: "Features" },
	{ id: "address", title: "Address" },
];

/**
 * The Docs tab: settings for the whole docs, in five sections that stay closed until clicked (one
 * open at a time). A click on the canvas's top bar or sidebar opens Header or Navigation here.
 */
export function DocsSettingsTab(): ReactElement {
	const { settings, saveSettings, isHome, homeId, tree, panel, treeLoading, treeFailed } = useRequiredDocsMode();
	const save = (patch: UpdateDocsSettingsInput): void => void saveSettings(patch);

	const bodies = (): Record<DocsSection, ReactNode> => ({
		header: settings ? <DocsHeaderSection settings={settings} save={save} live={isHome} /> : null,
		navigation: <DocsNavigationSection />,
		search: settings ? <DocsSearchSection settings={settings} save={save} live={isHome} /> : null,
		features: settings ? <DocsFeaturesSection settings={settings} save={save} /> : null,
		address: <DocsAddressSection path={tree?.home.path ?? ""} homeId={homeId} isHome={isHome} />,
	});

	if (!settings && !treeLoading) {
		return (
			<p className="px-4 py-4 text-sm text-npb-text-muted" role="status">
				{treeFailed ? "Couldn't load the docs settings. Reload the editor to try again." : "This page isn't part of any docs."}
			</p>
		);
	}

	return (
		<div>
			<p className="npb-settings-hint-muted px-4 pt-4 text-xs">
				{isHome ? "These settings are for the whole docs. They are part of this page, so Save keeps them." : "These settings are for the whole docs and are saved as soon as you change them."}
			</p>
			{SECTION_TITLES.map(({ id, title }) => {
				const open = panel.section === id;
				return (
					<CollapsibleCard key={id} title={title} open={open} onOpenChange={(next) => panel.setSection(next ? id : null)}>
						{open ? bodies()[id] : null}
					</CollapsibleCard>
				);
			})}
		</div>
	);
}
