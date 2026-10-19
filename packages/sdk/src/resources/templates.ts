import type { BlocksBuilder } from "../blocks/blocks-builder.types.js";
import type { HttpClient } from "../client/http-client.js";
import { parseInput } from "../client/validate-input.js";
import {
	createTemplateSchema,
	duplicateTemplateSchema,
	idParamSchema,
	listTemplatesQuerySchema,
	updateTemplateSchema,
} from "../schemas/index.js";
import {
	createTemplatePartSchema,
	listTemplatePartsQuerySchema,
} from "../schemas/template-parts.js";
import type { DeleteMessage, PaginatedResponse, Template } from "../types/domain.js";
import type {
	CreateTemplateInput,
	DuplicateTemplateInput,
	ListTemplatesQuery,
	UpdateTemplateInput,
} from "../types/inputs.js";
import { DEFAULT_TEMPLATE_ROOT } from "../types/template-part-root.js";
import type {
	CreateTemplatePartInput,
	ListTemplatePartsQuery,
	TemplatePart,
	TemplatePartListItem,
	TemplatePartUsage,
} from "../types/template-parts.js";

export type TemplatesResource = {
	list: (params?: ListTemplatesQuery) => Promise<PaginatedResponse<Template, "templates">>;
	get: (params: { id: string }) => Promise<Template>;
	create: (input: CreateTemplateInput) => Promise<Template>;
	duplicate: (params: { id: string } & DuplicateTemplateInput) => Promise<Template>;
	update: (params: { id: string } & UpdateTemplateInput) => Promise<Template>;
	delete: (params: { id: string }) => Promise<DeleteMessage>;
	/**
	 * List this site's linked template parts, each with `usedOnPages`. Parts belong to one site;
	 * `list` (pre-designed blocks, copied into a page) never includes them and stays global.
	 */
	listParts: (
		params?: ListTemplatePartsQuery,
	) => Promise<PaginatedResponse<TemplatePartListItem, "templates">>;
	/**
	 * Create a linked part on this site: a header, footer or any section you design once and show
	 * on many pages through a `core/template-part` block, so one edit reaches every page.
	 * A part is exactly one layout or container block (Group, Stack, Columns, Container, Header,
	 * Accordion, Popup or Form) with anything inside; anything else fails here before the request.
	 * With no `blocks`, it starts as one empty `rootBlock` (default `core/group`), like the dashboard.
	 */
	createPart: (input: CreateTemplatePartInput) => Promise<TemplatePart>;
	/**
	 * Find the pages that show a part. Check this before deleting or reshaping a part, because
	 * every page listed changes with it. A pre-designed block, which is copied into pages,
	 * returns no pages.
	 */
	usage: (params: { id: string }) => Promise<TemplatePartUsage>;
};

/** Templates for headers, footers, pages, posts, and popups, plus linked template parts. */
export function createTemplatesResource({
	http,
	blocks,
}: {
	http: HttpClient;
	blocks: BlocksBuilder;
}): TemplatesResource {
	return {
		list: async (
			params: ListTemplatesQuery = {},
		): Promise<PaginatedResponse<Template, "templates">> => {
			const query = parseInput({
				schema: listTemplatesQuerySchema,
				input: params,
				label: "templates.list params",
			});
			return http.request("/api/templates", { query });
		},

		get: async ({ id }: { id: string }): Promise<Template> => {
			parseInput({ schema: idParamSchema, input: { id }, label: "templates.get id" });
			return http.request(`/api/templates/${id}`);
		},

		create: async (input: CreateTemplateInput): Promise<Template> => {
			const body = parseInput({
				schema: createTemplateSchema,
				input,
				label: "templates.create input",
			});
			return http.request("/api/templates", { method: "POST", body });
		},

		duplicate: async ({
			id,
			...input
		}: { id: string } & DuplicateTemplateInput): Promise<Template> => {
			parseInput({
				schema: idParamSchema,
				input: { id },
				label: "templates.duplicate id",
			});
			const body = parseInput({
				schema: duplicateTemplateSchema,
				input,
				label: "templates.duplicate input",
			});
			return http.request(`/api/templates/${id}/duplicate`, { method: "POST", body });
		},

		update: async ({ id, ...input }: { id: string } & UpdateTemplateInput): Promise<Template> => {
			parseInput({ schema: idParamSchema, input: { id }, label: "templates.update id" });
			const body = parseInput({
				schema: updateTemplateSchema,
				input,
				label: "templates.update input",
			});
			return http.request(`/api/templates/${id}`, { method: "PUT", body });
		},

		delete: async ({ id }: { id: string }): Promise<DeleteMessage> => {
			parseInput({ schema: idParamSchema, input: { id }, label: "templates.delete id" });
			return http.request(`/api/templates/${id}`, { method: "DELETE" });
		},

		listParts: async (
			params: ListTemplatePartsQuery = {},
		): Promise<PaginatedResponse<TemplatePartListItem, "templates">> => {
			const query = parseInput({
				schema: listTemplatePartsQuerySchema,
				input: params,
				label: "templates.listParts params",
			});
			return http.request("/api/templates", { query: { ...query, usage: "part" } });
		},

		createPart: async (input: CreateTemplatePartInput): Promise<TemplatePart> => {
			const parsed = parseInput({
				schema: createTemplatePartSchema,
				input,
				label: "templates.createPart input",
			});
			const startingBlocks = input.blocks ?? [
				blocks.fromName(parsed.rootBlock ?? DEFAULT_TEMPLATE_ROOT),
			];
			return http.request("/api/templates", {
				method: "POST",
				body: { name: parsed.name, usage: "part", blocks: startingBlocks },
			});
		},

		usage: async ({ id }: { id: string }): Promise<TemplatePartUsage> => {
			parseInput({ schema: idParamSchema, input: { id }, label: "templates.usage id" });
			return http.request(`/api/templates/${id}/usage`);
		},
	};
}
