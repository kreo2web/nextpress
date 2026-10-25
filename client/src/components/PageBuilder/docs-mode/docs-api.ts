import { apiRequest } from "@/lib/queryClient";
import type {
	AddDocsItemInput,
	DocsSettings,
	DocsTree,
	DocsTreeItem,
	ReorderDocsInput,
	UpdateDocsItemInput,
	UpdateDocsSettingsInput,
} from "@shared/docs";

/**
 * The editor's side of the docs routes (`shared/docs/types.ts` lists them). Each call returns the
 * checked answer or throws an Error whose message is already in plain words: the server writes
 * those, and a lost connection gets one here.
 */

const DOCS = "/api/docs";

const unexpected = (what: string): Error => new Error(`The server's answer about ${what} was not in the expected shape`);

const hasKeys = (value: object, keys: string[]): boolean => keys.every((key) => key in value);

const isTreeItem = (value: object | null): value is DocsTreeItem =>
	value !== null && hasKeys(value, ["id", "title", "slug", "path", "kind", "hidden", "children"]) && Array.isArray((value as DocsTreeItem).children);

const isDocsTree = (value: object): value is DocsTree => hasKeys(value, ["home", "settings"]) && isTreeItem((value as DocsTree).home);

/** The plain sentence for a failed call: the server's own when it sent one, else a line about the connection. */
export function describeDocsFailure(error: Error & { status?: number }): string {
	if (typeof error.status === "number") return error.message;
	return "Couldn't reach the server. Check your connection and try again.";
}

const itemUrl = (pageId: string): string => `${DOCS}/items/${encodeURIComponent(pageId)}`;
const homeUrl = (homeId: string): string => `${DOCS}/${encodeURIComponent(homeId)}`;

/** The tree and settings of the docs a page sits in. */
export async function fetchDocsTreeOfPage({ pageId }: { pageId: string }): Promise<DocsTree> {
	const response = await apiRequest("GET", itemUrl(pageId));
	const body = (await response.json()) as object;
	if (!isDocsTree(body)) throw unexpected("these docs");
	return body;
}

/** Changes the docs-wide settings; the answer is the settings as the server now keeps them. */
export async function saveDocsSettings({ homeId, patch }: { homeId: string; patch: UpdateDocsSettingsInput }): Promise<DocsSettings> {
	const response = await apiRequest("PUT", `${homeUrl(homeId)}/settings`, patch);
	const body = (await response.json()) as { settings?: DocsSettings };
	if (!body.settings) throw unexpected("the docs settings");
	return body.settings;
}

export async function addDocsItem({ homeId, input }: { homeId: string; input: AddDocsItemInput }): Promise<DocsTreeItem> {
	const response = await apiRequest("POST", `${homeUrl(homeId)}/items`, input);
	const body = (await response.json()) as { item?: object };
	if (!body.item || !isTreeItem(body.item)) throw unexpected("the new page");
	return body.item;
}

export async function updateDocsItem({ pageId, input }: { pageId: string; input: UpdateDocsItemInput }): Promise<DocsTreeItem> {
	const response = await apiRequest("PATCH", itemUrl(pageId), input);
	const body = (await response.json()) as { item?: object };
	if (!body.item || !isTreeItem(body.item)) throw unexpected("the changed page");
	return body.item;
}

export async function reorderDocsItems({ homeId, input }: { homeId: string; input: ReorderDocsInput }): Promise<void> {
	await apiRequest("PUT", `${homeUrl(homeId)}/order`, input);
}

export async function deleteDocsItem({ pageId }: { pageId: string }): Promise<void> {
	await apiRequest("DELETE", itemUrl(pageId));
}
