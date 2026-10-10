import { sql } from "drizzle-orm";
import { pages } from "@shared/schema";
import type { BlockConfig } from "@shared/schema-types";
import { collectTemplatePartIds } from "@shared/template-parts";
import type { Deps } from "../../routes/shared/deps";

export type TemplatePartUsagePage = { id: string; title: string; status: string | null };

/**
 * Which pages of one site show each linked template. Drafts and private pages count, because they
 * will show the part once published. Trashed pages do not. A LIKE scan narrows the rows first; the
 * tree walk then confirms each page really holds a part.
 *
 * Only pages are counted. A part placed inside another template is shown through that template,
 * so its pages are not listed here.
 */
export async function findTemplatePartUsage({
	models,
	siteId,
}: {
	models: Pick<Deps["models"], "pages">;
	siteId: string;
}): Promise<Map<string, TemplatePartUsagePage[]>> {
	const rows = await models.pages.findManyWhere(
		sql`${pages.siteId} = ${siteId} and ${pages.status} is distinct from 'trash' and ${pages.blocks}::text like '%core/template-part%'`,
	);
	const usage = new Map<string, TemplatePartUsagePage[]>();
	for (const page of rows) {
		const blocks = Array.isArray(page.blocks) ? (page.blocks as BlockConfig[]) : [];
		const entry = { id: page.id, title: page.title, status: page.status ?? null };
		for (const templateId of collectTemplatePartIds(blocks)) {
			usage.set(templateId, [...(usage.get(templateId) ?? []), entry]);
		}
	}
	return usage;
}
