import { Router } from "express";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { resolveSiteRenderContext } from "./shared/resolve-site-render-context";
import { getSiteBlogIds } from "./shared/site-content";
import { loadSitePagePaths, SITE_PAGE_LIMIT } from "../lib/page-paths/page-paths";
import { buildSitemap, collectSitemapEntries } from "../lib/sitemap/build-sitemap";
import { safeTryAsync } from "../utils";

/**
 * `/sitemap.xml`, which `robots.txt` already points search engines at. Lists the home, every page
 * visitors can open (at its nested address) and every post. When Settings → Reading asks search
 * engines to stay away, the sitemap is empty rather than missing, so they see a valid answer.
 */
export function createSitemapRoutes(deps: Deps): Router {
	const router = Router();
	const { models } = deps;

	router.get(
		"/sitemap.xml",
		asyncHandler(async (req, res) => {
			const { err, result } = await safeTryAsync(async () => {
				const context = await resolveSiteRenderContext({ models, req });
				if (!context) return null;
				const siteId = context.site.id;
				const baseUrl = (context.settings.url || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
				const settings = await models.sites.getSettings(siteId);
				if (settings.reading.discourageSearchIndexing) return buildSitemap({ baseUrl, entries: [] });

				const [pages, paths, homepage, blogIds] = await Promise.all([
					models.pages.findManyWhere([{ where: "siteId", equals: siteId }, { where: "status", equals: "publish" }], { limit: SITE_PAGE_LIMIT }),
					loadSitePagePaths({ models, siteId }),
					models.options.getOption("homepage_page_slug", siteId),
					getSiteBlogIds({ models, siteId }),
				]);
				const posts =
					blogIds.length === 0
						? []
						: await models.posts.findManyWhere([{ where: "status", equals: "publish" }, { where: "blogId", in: blogIds }], { limit: SITE_PAGE_LIMIT });
				const homepageSlug = typeof homepage?.value === "string" && homepage.value ? homepage.value : null;
				return buildSitemap({ baseUrl, entries: collectSitemapEntries({ pages, paths, homepageSlug, posts }) });
			});
			if (err) {
				console.error({ atFunction: "sitemap.xml", data: { host: req.get("host") ?? null, error: err }, message: "Could not build the sitemap" });
				return res.status(500).type("text/plain; charset=utf-8").send("The sitemap could not be made right now. Try again in a moment.\n");
			}
			if (result === null) return res.status(404).type("text/plain; charset=utf-8").send("This site has no sitemap.\n");
			res.setHeader("Cache-Control", "public, max-age=600");
			res.type("application/xml; charset=utf-8").send(result);
		}),
	);

	return router;
}
