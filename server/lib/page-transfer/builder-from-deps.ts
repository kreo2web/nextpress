import type { Deps } from "../../routes/shared/deps";
import { resolveSiteThemeSettings } from "../../routes/shared/resolve-site-theme-settings";
import { resolvePageTemplateParts } from "../template-parts";
import { NEXTPRESS_CONFIG } from "../../../config";
import { createPagePackageBuilder } from "./build-page-package";

/**
 * The page-file builder wired to this app: the site's media, its active theme, and linked template
 * parts swapped for their current blocks so a page file stands on its own. Page export and docs
 * export both use it, so a docs file is an ordinary page file.
 */
export function createPagePackageBuilderFromDeps({ models, uploadDir, CONFIG }: Pick<Deps, "models" | "uploadDir" | "CONFIG">) {
	return createPagePackageBuilder({
		listSiteMedia: (siteId) => models.media.findManyWhere([{ where: "siteId", equals: siteId }]),
		readActiveTheme: async (siteId) => {
			const resolved = await resolveSiteThemeSettings({ models, siteId });
			if (!resolved.themeId) return null;
			const theme = await models.themes.findById(resolved.themeId);
			if (!theme) return null;
			return {
				name: theme.name,
				description: theme.description ?? null,
				settings: resolved.settings as unknown as Record<string, unknown>,
			};
		},
		resolvePageParts: async ({ siteId, pageId, blocks }) => (await resolvePageTemplateParts({ models, siteId, pageId, blocks })).blocks,
		uploadDir,
		uploadLimit: CONFIG.UPLOAD.LIMIT,
		appVersion: NEXTPRESS_CONFIG.version,
	});
}
