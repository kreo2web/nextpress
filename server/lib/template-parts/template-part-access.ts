import type { Template } from "@shared/schema-types";
import { isTemplatePart, readTemplatePartSiteId } from "@shared/template-usage";
import type { Deps } from "../../routes/shared/deps";
import { resolveAccessibleSites } from "../../routes/shared/resolve-accessible-sites";

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
	models: Pick<Deps["models"], "sites" | "userRoles">;
	userId: string | null;
	keySiteId: string | null;
	template: Pick<Template, "other">;
}): Promise<boolean> {
	if (!isTemplatePart(template.other)) return true;
	const siteId = readTemplatePartSiteId(template.other);
	if (!siteId || !userId) return false;
	if (keySiteId && keySiteId !== siteId) return false;
	const sites = await resolveAccessibleSites({ models, userId });
	return sites.some((site) => site.id === siteId);
}
