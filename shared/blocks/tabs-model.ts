import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const TABS_BLOCK_NAME = "core/tabs";
export const TAB_BLOCK_NAME = "core/tab";

export const TABS_LOOKS = ["underline", "pills", "segmented"] as const;
export type TabsLook = (typeof TABS_LOOKS)[number];

/** Tabs that switch what shows below them. Each child is a `core/tab`; the first is open at the start. */
export type TabsContent = { look: TabsLook };
/** One tab: its title on the tab bar, with its content as child blocks. */
export type TabContent = { title: string };

export const DEFAULT_TABS_CONTENT: TabsContent = { look: "underline" };
export const DEFAULT_TAB_CONTENT: TabContent = { title: "Tab" };

export function readTabsContent(content: BlockContent | undefined): TabsContent {
	return { look: readChoice({ value: readStructuredData(content).look, options: TABS_LOOKS, fallback: "underline" }) };
}

export function readTabContent(content: BlockContent | undefined): TabContent {
	return { title: readText(readStructuredData(content).title, DEFAULT_TAB_CONTENT.title) };
}

/** The ids that tie a tab button to its panel (`aria-controls` / `aria-labelledby`), the same in editor and page. */
export const tabElementIds = ({ tabsId, index }: { tabsId: string; index: number }): { tab: string; panel: string } => ({
	tab: `np-tabs-${tabsId}-tab-${index}`,
	panel: `np-tabs-${tabsId}-panel-${index}`,
});
