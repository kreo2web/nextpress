import type { HttpClient } from "../client/http-client.js";
import type { NextpressError } from "../client/nextpress-error.js";
import { safeHttpRequest } from "../client/safe-request.js";
import type { SdkResult } from "../client/sdk-result.js";
import { parseInput } from "../client/validate-input.js";
import {
	addDocsItemSchema,
	createDocsSchema,
	exportDocsQuerySchema,
	listDocsQuerySchema,
	reorderDocsSchema,
	updateDocsItemSchema,
	updateDocsSettingsSchema,
	writeDocsPageSchema,
} from "../schemas/docs.js";
import { idParamSchema } from "../schemas/index.js";
import type { DownloadedFile } from "../types/client.js";
import type {
	AddDocsItemParams,
	CreateDocsParams,
	CreateDocsResult,
	DocsOkResult,
	DocsPageMdx,
	DocsSettings,
	DocsSummary,
	DocsTree,
	DocsTreeItem,
	ExportDocsParams,
	ListDocsParams,
	ReorderDocsParams,
	UpdateDocsItemParams,
	UpdateDocsSettingsParams,
	WriteDocsPageParams,
	WriteDocsPageResult,
} from "../types/docs.js";
import type { PageTransferFile } from "../types/page-transfer.js";

const DOCS_PATH = "/api/docs";

/** Used only if the server sends a page file without a name. */
const FALLBACK_EXPORT_FILE_NAME = "docs.nextpress-page.json";

export type DocsResource = {
	/** The docs on a site, for lists and pickers. A read: it throws on a server refusal. */
	list: (params?: ListDocsParams) => Promise<{ docs: DocsSummary[] }>;
	/**
	 * Make a docs: its home page (empty, ready to write) and its settings. Returns a result: the
	 * new `homeId` is what the other docs calls take.
	 */
	create: (params: CreateDocsParams) => Promise<SdkResult<CreateDocsResult>>;
	/** The navigation tree of a docs and its settings. A read: it throws on a server refusal. */
	tree: (params: { homeId: string }) => Promise<DocsTree>;
	/** The tree of the docs a page sits in, for when only the page's id is known. A read. */
	treeOfPage: (params: { pageId: string }) => Promise<DocsTree>;
	/** Change the header, search and switches. Only the fields given change. */
	updateSettings: (
		params: UpdateDocsSettingsParams,
	) => Promise<SdkResult<{ settings: DocsSettings }>>;
	/**
	 * Add a page or a group under a page or group of the same docs. A group takes no text. Pages are
	 * drafts. Returns the new row of the tree.
	 */
	addItem: (params: AddDocsItemParams) => Promise<SdkResult<{ item: DocsTreeItem }>>;
	/** Rename, move, hide, change the address of, or change the kind of one page or group. */
	updateItem: (params: UpdateDocsItemParams) => Promise<SdkResult<{ item: DocsTreeItem }>>;
	/**
	 * Set the order of one parent's pages. `orderedIds` must list exactly those pages, each once, or
	 * the server refuses it (409) and nothing moves.
	 */
	reorder: (params: ReorderDocsParams) => Promise<SdkResult<DocsOkResult>>;
	/** Delete a page. The server refuses a page that still has pages under it (409). */
	deleteItem: (params: { pageId: string }) => Promise<SdkResult<DocsOkResult>>;
	/**
	 * A docs page as MDX, with the `version` a write must send back. A read: it throws on a server
	 * refusal. `skipped` lists blocks that have no MDX form; writing the MDX back drops them.
	 */
	readPage: (params: { pageId: string }) => Promise<DocsPageMdx>;
	/**
	 * Save a page's MDX as a new version. A broken MDX is refused with a 400 whose line is read with
	 * `readDocsMdxProblem`. A `version` that is no longer current is refused with `VERSION_STALE` (409):
	 * read the page again, then write again. Nothing is saved on a refusal.
	 */
	writePage: (params: WriteDocsPageParams) => Promise<SdkResult<WriteDocsPageResult>>;
	/**
	 * Download the whole docs as a page file: the same file `pageTransfer.import` takes, so a docs can
	 * move to another site with its tree and order. Pass `includeFiles: false` to leave images out.
	 */
	exportFile: (params: ExportDocsParams) => Promise<PageTransferFile>;
};

/** The MDX problem a refused `writePage` names: the message, and the line to fix when the server could place it. */
export type DocsMdxProblem = { message: string; line: number | null };

/** The body a refused MDX write carries, as the server sends it. */
type DocsMdxRefusalBody = { ok?: boolean; message?: string; line?: number | null };

/**
 * Reads the MDX problem out of a refused `writePage`. Returns null for any other error, so a caller
 * can tell "fix line 3" apart from "the page changed" (409) or "not allowed" (403).
 */
export function readDocsMdxProblem(error: NextpressError): DocsMdxProblem | null {
	if (error.status !== 400) return null;
	const body = error.body as DocsMdxRefusalBody | undefined;
	if (body?.ok !== false || typeof body.message !== "string") return null;
	return { message: body.message, line: typeof body.line === "number" ? body.line : null };
}

/**
 * Docs: a site's docs, their navigation, pages written as MDX, and a whole docs as one page file.
 * The routes are the server's `/api/docs` routes; the id checks run before any request is sent.
 */
export function createDocsResource({ http }: { http: HttpClient }): DocsResource {
	return {
		list: async (params: ListDocsParams = {}): Promise<{ docs: DocsSummary[] }> => {
			const query = parseInput({
				schema: listDocsQuerySchema,
				input: params,
				label: "docs.list params",
			});
			return http.request(DOCS_PATH, { query });
		},

		create: async (params: CreateDocsParams): Promise<SdkResult<CreateDocsResult>> => {
			// The server requires the site in the body, so the client's site fills it in when none is named.
			const body = parseInput({
				schema: createDocsSchema,
				input: { ...params, siteId: params.siteId ?? http.config.siteId, slug: params.slug ?? "" },
				label: "docs.create input",
			});
			return safeHttpRequest(http, DOCS_PATH, { method: "POST", body });
		},

		tree: async ({ homeId }: { homeId: string }): Promise<DocsTree> => {
			parseInput({ schema: idParamSchema, input: { id: homeId }, label: "docs.tree homeId" });
			return http.request(`${DOCS_PATH}/${homeId}/tree`);
		},

		treeOfPage: async ({ pageId }: { pageId: string }): Promise<DocsTree> => {
			parseInput({ schema: idParamSchema, input: { id: pageId }, label: "docs.treeOfPage pageId" });
			return http.request(`${DOCS_PATH}/items/${pageId}`);
		},

		updateSettings: async ({
			homeId,
			...input
		}: UpdateDocsSettingsParams): Promise<SdkResult<{ settings: DocsSettings }>> => {
			parseInput({
				schema: idParamSchema,
				input: { id: homeId },
				label: "docs.updateSettings homeId",
			});
			const body = parseInput({
				schema: updateDocsSettingsSchema,
				input,
				label: "docs.updateSettings input",
			});
			return safeHttpRequest(http, `${DOCS_PATH}/${homeId}/settings`, { method: "PUT", body });
		},

		addItem: async ({
			homeId,
			...input
		}: AddDocsItemParams): Promise<SdkResult<{ item: DocsTreeItem }>> => {
			parseInput({ schema: idParamSchema, input: { id: homeId }, label: "docs.addItem homeId" });
			const body = parseInput({ schema: addDocsItemSchema, input, label: "docs.addItem input" });
			return safeHttpRequest(http, `${DOCS_PATH}/${homeId}/items`, { method: "POST", body });
		},

		updateItem: async ({
			pageId,
			...input
		}: UpdateDocsItemParams): Promise<SdkResult<{ item: DocsTreeItem }>> => {
			parseInput({ schema: idParamSchema, input: { id: pageId }, label: "docs.updateItem pageId" });
			const body = parseInput({
				schema: updateDocsItemSchema,
				input,
				label: "docs.updateItem input",
			});
			return safeHttpRequest(http, `${DOCS_PATH}/items/${pageId}`, { method: "PATCH", body });
		},

		reorder: async ({ homeId, ...input }: ReorderDocsParams): Promise<SdkResult<DocsOkResult>> => {
			parseInput({ schema: idParamSchema, input: { id: homeId }, label: "docs.reorder homeId" });
			const body = parseInput({ schema: reorderDocsSchema, input, label: "docs.reorder input" });
			return safeHttpRequest(http, `${DOCS_PATH}/${homeId}/order`, { method: "PUT", body });
		},

		deleteItem: async ({ pageId }: { pageId: string }): Promise<SdkResult<DocsOkResult>> => {
			parseInput({ schema: idParamSchema, input: { id: pageId }, label: "docs.deleteItem pageId" });
			return safeHttpRequest(http, `${DOCS_PATH}/items/${pageId}`, { method: "DELETE" });
		},

		readPage: async ({ pageId }: { pageId: string }): Promise<DocsPageMdx> => {
			parseInput({ schema: idParamSchema, input: { id: pageId }, label: "docs.readPage pageId" });
			return http.request(`${DOCS_PATH}/pages/${pageId}/mdx`);
		},

		writePage: async ({
			pageId,
			...input
		}: WriteDocsPageParams): Promise<SdkResult<WriteDocsPageResult>> => {
			parseInput({ schema: idParamSchema, input: { id: pageId }, label: "docs.writePage pageId" });
			const body = parseInput({
				schema: writeDocsPageSchema,
				input,
				label: "docs.writePage input",
			});
			return safeHttpRequest(http, `${DOCS_PATH}/pages/${pageId}/mdx`, { method: "PUT", body });
		},

		exportFile: async ({ homeId, includeFiles }: ExportDocsParams): Promise<PageTransferFile> => {
			parseInput({ schema: idParamSchema, input: { id: homeId }, label: "docs.exportFile homeId" });
			const parsed = parseInput({
				schema: exportDocsQuerySchema,
				input: { includeFiles },
				label: "docs.exportFile params",
			});
			// The server only leaves files out for the exact text "0", so booleans are sent as 1 or 0.
			const query =
				parsed.includeFiles === undefined ? {} : { files: parsed.includeFiles ? "1" : "0" };
			const file = await http.request<DownloadedFile>(`${DOCS_PATH}/${homeId}/export`, {
				query,
				responseType: "file",
			});
			return {
				bytes: file.bytes,
				fileName: file.fileName ?? FALLBACK_EXPORT_FILE_NAME,
				contentType: file.contentType,
			};
		},
	};
}
