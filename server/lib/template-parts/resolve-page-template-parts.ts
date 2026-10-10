import type { BlockConfig, Template } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import {
	resolveTemplateParts,
	type LoadedTemplate,
	type ResolvedTemplateParts,
} from "./resolve-template-parts";

const toLoadedTemplate = (row: Template): LoadedTemplate => ({
	id: row.id,
	other: row.other,
	blocks: Array.isArray(row.blocks) ? (row.blocks as BlockConfig[]) : [],
	updatedAt: row.updatedAt,
});

/**
 * Resolves the parts of one page or post against the live template rows. Callers pass the site the
 * content belongs to; a part whose template belongs to another site is refused.
 */
export function resolvePageTemplateParts({
	models,
	siteId,
	pageId,
	blocks,
}: {
	models: Pick<Deps["models"], "templates">;
	siteId: string | null;
	pageId: string;
	blocks: BlockConfig[];
}): Promise<ResolvedTemplateParts> {
	return resolveTemplateParts({
		blocks,
		siteId,
		pageId,
		loadTemplate: async (templateId) => {
			const row = await models.templates.findById(templateId);
			return row ? toLoadedTemplate(row) : null;
		},
	});
}
