import { sql, type SQL } from "drizzle-orm";
import { templates } from "@shared/schema";
import type { Template } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { findTemplatePartUsage } from "./template-part-usage";

type TemplateListModels = Pick<Deps["models"], "templates" | "pages">;

export type TemplateListPage<T> = {
	templates: T[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
};

export type LinkedTemplateRow = Template & { usedOnPages: number };

/**
 * Rows that are not linked parts. A row with no `other` at all is a pre-designed block too, so the
 * check is "distinct from part" rather than "equals something".
 */
const PRE_DESIGNED_FILTER = sql`(${templates.other} ->> 'usage') is distinct from 'part'`;

const partsOfSiteFilter = (siteId: string): SQL =>
	sql`(${templates.other} ->> 'usage') = 'part' and (${templates.other} ->> 'siteId') = ${siteId}`;

const listTemplates = async ({
	models,
	where,
	page,
	perPage,
	orderBy,
}: {
	models: TemplateListModels;
	where: SQL;
	page: number;
	perPage: number;
	orderBy?: { property: string; order: "ascending" | "descending" };
}): Promise<TemplateListPage<Template>> => {
	const rows = await models.templates.findManyWhere(where, {
		limit: perPage,
		offset: (page - 1) * perPage,
		...(orderBy ? { orderBy } : {}),
	});
	const total = await models.templates.count({ where });
	return {
		templates: rows,
		total,
		page,
		per_page: perPage,
		total_pages: Math.ceil(total / perPage),
	};
};

/** The pre-designed blocks list. `type` narrows it to one template type when given. */
export function listPreDesignedTemplates({
	models,
	type,
	page,
	perPage,
}: {
	models: TemplateListModels;
	type?: string;
	page: number;
	perPage: number;
}): Promise<TemplateListPage<Template>> {
	const where = type
		? sql`${PRE_DESIGNED_FILTER} and ${templates.type} = ${type}`
		: PRE_DESIGNED_FILTER;
	return listTemplates({ models, where, page, perPage });
}

/**
 * The linked templates of one site, each with the number of pages that show it. The usage count is
 * computed from the pages of that site, so one request costs one scan of those pages.
 */
export async function listLinkedTemplateParts({
	models,
	siteId,
	page,
	perPage,
}: {
	models: TemplateListModels;
	siteId: string;
	page: number;
	perPage: number;
}): Promise<TemplateListPage<LinkedTemplateRow>> {
	const [list, usage] = await Promise.all([
		listTemplates({
			models,
			where: partsOfSiteFilter(siteId),
			page,
			perPage,
			orderBy: { property: "name", order: "ascending" },
		}),
		findTemplatePartUsage({ models, siteId }),
	]);
	return {
		...list,
		templates: list.templates.map((template) => ({
			...template,
			usedOnPages: usage.get(template.id)?.length ?? 0,
		})),
	};
}
