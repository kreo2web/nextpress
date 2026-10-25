import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const TABS_BLOCK_NAME = "core/tabs";
export const TAB_BLOCK_NAME = "core/tab";

export const TABS_LOOKS = ["underline", "pills", "segmented"] as const;
export type TabsLook = (typeof TABS_LOOKS)[number];

/**
 * Tabs that switch what shows below them. Each child is a `core/tab`; the first is open at the
 * start. `linkable` gives every tab its own link (`#tab-name`), so a reader can share or
 * bookmark the tab they are on; on by default, because that is what docs want.
 */
export type TabsContent = { look: TabsLook; linkable: boolean };
/** One tab: its title on the tab bar, with its content as child blocks. */
export type TabContent = { title: string };

export const DEFAULT_TABS_CONTENT: TabsContent = { look: "underline", linkable: true };
export const DEFAULT_TAB_CONTENT: TabContent = { title: "Tab" };

export function readTabsContent(content: BlockContent | undefined): TabsContent {
	const data = readStructuredData(content);
	return {
		look: readChoice({ value: data.look, options: TABS_LOOKS, fallback: "underline" }),
		linkable: data.linkable !== false,
	};
}

export function readTabContent(content: BlockContent | undefined): TabContent {
	return { title: readText(readStructuredData(content).title, DEFAULT_TAB_CONTENT.title) };
}

/** The ids that tie a tab button to its panel (`aria-controls` / `aria-labelledby`), the same in editor and page. */
export const tabElementIds = ({ tabsId, index }: { tabsId: string; index: number }): { tab: string; panel: string } => ({
	tab: `np-tabs-${tabsId}-tab-${index}`,
	panel: `np-tabs-${tabsId}-panel-${index}`,
});

/**
 * A tab title as a link name: lower case, words joined by `-`, punctuation dropped. The same
 * rules as heading anchors, so the two kinds of `#link` look alike. Empty when nothing is left
 * (a blank title, or only punctuation).
 */
export const slugifyTabTitle = (title: string): string =>
	title
		.trim()
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
		.replace(/\s+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-|-$/g, "");

const firstFreeSlug = ({ base, taken, count = 1 }: { base: string; taken: ReadonlySet<string>; count?: number }): string => {
	const slug = count === 1 ? base : `${base}-${count}`;
	return taken.has(slug) ? firstFreeSlug({ base, taken, count: count + 1 }) : slug;
};

/**
 * The link name of each tab in one Tabs, in order, none repeated: a second "npm" is `npm-2`, a third
 * `npm-3`; a tab with no usable title is `tab-<its number>`. Pure and the same on every render,
 * because the page and the editor must agree and the numbers must not shift between renders.
 * `/vendor/tabs.js` keeps names apart between Tabs blocks on the same page.
 */
export const tabSlugs = (titles: readonly string[]): string[] => {
	const taken = new Set<string>();
	return titles.map((title, index) => {
		const slug = firstFreeSlug({ base: slugifyTabTitle(title) || `tab-${index + 1}`, taken });
		taken.add(slug);
		return slug;
	});
};
