import type { Template } from "@shared/schema-types";
import { isTemplatePart, readTemplatePartSiteId } from "@shared/template-usage";
import type { Deps } from "../../routes/shared/deps";
import { resolveAccessibleSites } from "../../routes/shared/resolve-accessible-sites";
import { isMainSiteAdmin } from "../access/site-standing";

/**
 * Whether a signed-in request may read or change a template. Pre-designed blocks are shared by
 * every site, as they always were. A linked part belongs to one site, so only someone who can
 * manage that site may see it, and a site-bound API key may only reach its own site.
 */
export async function canManageTemplate({
	models,
	userId,
	keySiteId,
	template,
}: {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	userId: string | null;
	keySiteId: string | null;
	template: Pick<Template, "other">;
}): Promise<boolean> {
	if (!userId) return false;
	const sites = await resolveAccessibleSites({ models, userId });
	// Pre-designed blocks are shared by every site and copied into pages: any editor may manage them.
	if (!isTemplatePart(template.other)) return sites.length > 0;
	const siteId = readTemplatePartSiteId(template.other);
	if (!siteId) return false;
	if (keySiteId && keySiteId !== siteId) return false;
	return sites.some((site) => site.id === siteId);
}

/**
 * Whether a person may change or delete a template they can see. A linked part: its site's team.
 * A pre-designed block is one shared library for every site, so only the person who made it or a
 * main-site admin may change it; everyone else copies it into their page and edits the copy.
 */
export async function canChangeTemplate({
	models,
	userId,
	keySiteId,
	template,
}: {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	userId: string | null;
	keySiteId: string | null;
	template: Pick<Template, "other" | "authorId">;
}): Promise<boolean> {
	if (!userId || !(await canManageTemplate({ models, userId, keySiteId, template }))) return false;
	if (isTemplatePart(template.other)) return true;
	return String(template.authorId) === userId || isMainSiteAdmin({ models, userId });
}
