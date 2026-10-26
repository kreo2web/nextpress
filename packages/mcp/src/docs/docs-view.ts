import type { DocsItemKind, DocsSummary, DocsTreeItem } from "@nextpress-org/sdk";

/** One docs in a list, in the words the editor uses: its address, and how many pages it has. */
export type DocsSummaryView = {
	homeId: string;
	name: string;
	address: string;
	pages: number;
	searchOn: boolean;
	status: string;
};

/** One row of a docs' tree, in the words the editor uses. */
export type DocsItemView = {
	id: string;
	title: string;
	kind: DocsItemKind;
	address: string;
	status: string;
	hiddenFromSidebar: boolean;
	pagesUnder: DocsItemView[];
};

/** A docs as the agent reads it. The SDK's `path` is the address the editor shows. */
export function viewDocsSummary(docs: DocsSummary): DocsSummaryView {
	return {
		homeId: docs.homeId,
		name: docs.name,
		address: docs.path,
		pages: docs.pageCount,
		searchOn: docs.searchOn,
		status: docs.status,
	};
}

/** A tree row, and every row under it, as the agent reads them. */
export function viewItem(item: DocsTreeItem): DocsItemView {
	return {
		id: item.id,
		title: item.title,
		kind: item.kind,
		address: item.path,
		status: item.status,
		hiddenFromSidebar: item.hidden,
		pagesUnder: item.children.map(viewItem),
	};
}
