import { Router } from "express";
import type { Response } from "express";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { resolveSiteRenderContext } from "./shared/resolve-site-render-context";
import { isPubliclyReadable } from "../lib/is-publicly-readable";
import { buildLlmsTxt, pageAsMarkdown, type AgentPage } from "../lib/agent-pages/agent-pages";
import { safeTryAsync } from "../utils";
import { isReservedPublicPath } from "./shared/public-slug";
import { findPageByPath, loadSitePagePaths, SITE_PAGE_LIMIT } from "../lib/page-paths/page-paths";

const MARKDOWN_TYPE = "text/markdown; charset=utf-8";
/** These copies are for AI tools; search engines should list the real pages, not duplicates of them. */
const NOT_FOR_SEARCH_ENGINES = "noindex";

const sendMissing = (res: Response): void => {
	res.status(404).type("text/plain; charset=utf-8").send("This page is not available.\n");
};

/**
 * Pages for AI tools: `/llms.txt` lists the site's published pages and `/<address>.md` is one page as
 * markdown (`/guides/install.md` for a nested page; `/install.md` works too). Mounted before the page routes so a dotted address is never treated as a page slug;
 * the page route itself still skips dotted names, so nothing else changes.
 */
export function createAgentPageRoutes(deps: Deps): Router {
	const router = Router();
	const { models } = deps;

	router.get(
		"/llms.txt",
		asyncHandler(async (req, res) => {
			const { err, result } = await safeTryAsync(async () => {
				const context = await resolveSiteRenderContext({ models, req });
				if (!context) return null;
				const rows = await models.pages.findManyWhere(
					[{ where: "siteId", equals: context.site.id }, { where: "status", equals: "publish" }],
					{ limit: SITE_PAGE_LIMIT, orderBy: { property: "title", order: "ascending" } },
				);
				const paths = await loadSitePagePaths({ models, siteId: context.site.id });
				const pages = rows.filter((row) => isPubliclyReadable(row)).map((row) => ({ ...row, path: paths.get(row.id) ?? row.slug })) as AgentPage[];
				return buildLlmsTxt({ siteName: context.settings.name, siteDescription: context.settings.description, pages });
			});
			if (err) {
				console.error({ atFunction: "agentPages.llmsTxt", data: { host: req.get("host") ?? null, error: err }, message: "Could not build llms.txt" });
				return res.status(500).type("text/plain; charset=utf-8").send("This list could not be made right now. Try again in a moment.\n");
			}
			if (result === null) return sendMissing(res);
			res.setHeader("Cache-Control", "public, max-age=300");
			res.setHeader("X-Robots-Tag", NOT_FOR_SEARCH_ENGINES);
			res.type("text/plain; charset=utf-8").send(result);
		}),
	);

	router.get(
		/^\/(.+)\.md$/,
		asyncHandler(async (req, res, next) => {
			const slug = req.params[0] ?? "";
			// Only one word was ever a page here; a longer address under a fixed folder (`/vendor/readme.md`) is a file.
			if (slug.includes("/") && isReservedPublicPath(slug)) return next();
			const { err, result } = await safeTryAsync(async () => {
				const context = await resolveSiteRenderContext({ models, req });
				const found = context ? await findPageByPath({ models, siteId: context.site.id, path: slug }) : null;
				if (!context || !found || !isPubliclyReadable(found.page)) return null;
				return pageAsMarkdown(found.page as AgentPage);
			});
			if (err) {
				console.error({ atFunction: "agentPages.pageMarkdown", data: { slug, host: req.get("host") ?? null, error: err }, message: "Could not make the markdown for a page" });
				return res.status(500).type("text/plain; charset=utf-8").send("This page could not be loaded right now. Try again in a moment.\n");
			}
			if (result === null) return sendMissing(res);
			res.setHeader("Cache-Control", "public, max-age=60");
			res.setHeader("X-Robots-Tag", NOT_FOR_SEARCH_ENGINES);
			res.setHeader("Content-Type", MARKDOWN_TYPE);
			res.send(result);
		}),
	);

	return router;
}
