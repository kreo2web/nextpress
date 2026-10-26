import { useCallback, useState } from "react";
import type { DocsPanel } from "./docs-mode-context";
import type { DocsPanelTab, DocsSection } from "./docs-types";

/**
 * The right panel's tab and open section. A picked block opens the Block tab, and putting the
 * pick down (nothing picked) goes back to Page, without anyone clicking: the rule is applied
 * while rendering, from the change in the pick, so it never lags a frame behind.
 */
export function useDocsPanel({ pickedBlockId }: { pickedBlockId: string | null }): DocsPanel {
	const [tab, setTab] = useState<DocsPanelTab>("page");
	const [section, setSection] = useState<DocsSection | null>(null);
	const [lastPick, setLastPick] = useState<string | null>(pickedBlockId);

	if (pickedBlockId !== lastPick) {
		setLastPick(pickedBlockId);
		if (pickedBlockId) setTab("block");
		else if (tab === "block") setTab("page");
	}

	const openSection = useCallback((next: DocsSection) => {
		setTab("docs");
		setSection(next);
	}, []);

	return { tab: tab === "block" && !pickedBlockId ? "page" : tab, setTab, section, setSection, openSection };
}
