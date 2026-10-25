import type { DocsSettings, DocsTree, DocsTreeItem } from "../types/docs.js";

/** Ids of the docs fixtures shared by the docs resource tests. */
export const HOME_ID = "00000000-0000-4000-8000-0000000000d1";
export const PAGE_ID = "00000000-0000-4000-8000-0000000000d2";
export const GROUP_ID = "00000000-0000-4000-8000-0000000000d3";
export const OTHER_PAGE_ID = "00000000-0000-4000-8000-0000000000d4";

/** A tree row with plain defaults; a test changes only the fields it cares about. */
export const treeItem = (overrides: Partial<DocsTreeItem>): DocsTreeItem => ({
	id: PAGE_ID,
	title: "Install",
	slug: "install",
	path: "/docs/install",
	parentId: HOME_ID,
	menuOrder: 0,
	status: "draft",
	kind: "page",
	hidden: false,
	children: [],
	...overrides,
});

export const docsSettings: DocsSettings = {
	title: "Acme Docs",
	logoUrl: "",
	logoDarkUrl: "",
	links: [],
	button: { label: "", url: "" },
	search: { show: true, label: "Search", placeholder: "Search the docs" },
	features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
};

export const docsTree: DocsTree = {
	home: treeItem({
		id: HOME_ID,
		title: "Docs",
		slug: "docs",
		path: "/docs",
		parentId: null,
		children: [treeItem({})],
	}),
	settings: docsSettings,
};

/** A route handler that answers with the server's `{ message }` shape and the given status. */
export const refusal = (message: string, status: number) => () =>
	Response.json({ message }, { status });
