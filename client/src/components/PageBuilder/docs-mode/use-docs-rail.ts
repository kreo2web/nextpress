import { useCallback, useState } from "react";
import type { DocsRail } from "./docs-mode-context";
import type { DocsRailTab } from "./docs-types";

/**
 * The left rail's tab, remembered per browser: an editing comfort, not part of the docs. The first
 * time it opens on Pages, so the docs' pages are the first thing a writer sees.
 */
const STORAGE_KEY = "npb:docs-editor:rail-tab";
const RAIL_TABS: readonly DocsRailTab[] = ["pages", "blocks", "assistant"];

function readStored(): DocsRailTab {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		return RAIL_TABS.find((tab) => tab === stored) ?? "pages";
	} catch (error) {
		console.warn("[docs-rail] Could not read the saved tab", { error });
		return "pages";
	}
}

function writeStored(tab: DocsRailTab): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, tab);
	} catch (error) {
		console.warn("[docs-rail] Could not save the tab", { error, tab });
	}
}

export function useDocsRail(): DocsRail {
	const [state, setState] = useState(() => ({ tab: readStored(), shown: 0 }));
	const setTab = useCallback((next: DocsRailTab) => {
		setState((current) => ({ tab: next, shown: current.shown + 1 }));
		writeStored(next);
	}, []);
	return { tab: state.tab, shown: state.shown, setTab };
}
