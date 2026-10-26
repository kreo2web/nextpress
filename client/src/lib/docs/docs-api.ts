import { apiRequest } from "@/lib/queryClient";
import { appendSiteIdToUrl } from "@/lib/site-api";
import type { CreateDocsInput, CreateDocsResult, DocsSummary, DocsTree, DocsTreeItem } from "@shared/docs";

/**
 * Calls to the docs routes (`/api/docs`, listed in `shared/docs/types.ts`), so every screen asks
 * the server the same way. `apiRequest` turns a failed answer into an `Error` that carries the
 * server's plain message and its `status`.
 */

/** First part of every docs query key: invalidating it refreshes every docs list and tree at once. */
export const DOCS_QUERY_KEY = "/api/docs";

export const docsListKey = (siteId: string) => [DOCS_QUERY_KEY, "list", siteId] as const;
export const docsTreeKey = (homeId: string) => [DOCS_QUERY_KEY, "tree", homeId] as const;

/** The editor address of any page, which is also where a docs page opens. */
export const docsPageEditorPath = (pageId: string): string => `/admin/page-builder/page/${pageId}`;

/** The docs on one site (the screens show one per site; the data allows several). */
export async function fetchSiteDocs({ siteId }: { siteId: string }): Promise<DocsSummary[]> {
	const response = await apiRequest("GET", appendSiteIdToUrl(DOCS_QUERY_KEY, siteId));
	return ((await response.json()) as { docs: DocsSummary[] }).docs;
}

/** The pages of one docs as a tree, with its groups and hidden pages. */
export async function fetchDocsTree({ homeId }: { homeId: string }): Promise<DocsTree> {
	const response = await apiRequest("GET", `${DOCS_QUERY_KEY}/${encodeURIComponent(homeId)}/tree`);
	return (await response.json()) as DocsTree;
}

/** Creates the docs home (a draft) on `input.siteId`. The site comes in the body, never the query. */
export async function createDocs(input: CreateDocsInput): Promise<CreateDocsResult> {
	const response = await apiRequest("POST", DOCS_QUERY_KEY, input);
	return (await response.json()) as CreateDocsResult;
}

/** Adds one page under `parentId` (the docs home or any page or group of the same docs). */
export async function addDocsPage({
	homeId,
	parentId,
	title,
}: {
	homeId: string;
	parentId: string;
	title: string;
}): Promise<DocsTreeItem> {
	const response = await apiRequest("POST", `${DOCS_QUERY_KEY}/${encodeURIComponent(homeId)}/items`, {
		parentId,
		title,
		kind: "page",
	});
	return ((await response.json()) as { item: DocsTreeItem }).item;
}

/**
 * Downloads the whole docs as one page file and returns the file's name. The server names it from
 * the docs home's address; `fallbackName` is only used if that header is missing. With
 * `includeFiles: false` images and other files stay out and come back as placeholders on import.
 */
export async function downloadDocsFile({
	homeId,
	includeFiles,
	fallbackName,
}: {
	homeId: string;
	includeFiles: boolean;
	fallbackName: string;
}): Promise<string> {
	const response = await apiRequest(
		"GET",
		`${DOCS_QUERY_KEY}/${encodeURIComponent(homeId)}/export?files=${includeFiles ? "1" : "0"}`,
	);
	const disposition = response.headers.get("Content-Disposition") ?? "";
	const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
	const url = URL.createObjectURL(await response.blob());
	const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
	return fileName;
}
