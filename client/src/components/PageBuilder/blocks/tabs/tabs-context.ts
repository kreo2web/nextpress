import { createContext, useContext } from "react";

/**
 * A Tab on the canvas is drawn by the shared child list, so Tabs tells it which tab is open
 * and its own id (for matching ids) through context instead of props.
 */
export type TabsCanvasContext = {
	tabsId: string;
	/** Tab ids in order, so a Tab knows its number. */
	tabIds: readonly string[];
	activeTabId: string | null;
};

export const TabsContext = createContext<TabsCanvasContext>({ tabsId: "", tabIds: [], activeTabId: null });

export const useTabsContext = (): TabsCanvasContext => useContext(TabsContext);
