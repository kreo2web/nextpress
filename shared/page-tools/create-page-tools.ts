import { createChangeBlocksTool } from "./change-blocks-tool.js";
import { createCheckTools } from "./check-tools.js";
import { createDesignGuideTool, createReadTools } from "./read-tools.js";
import { createSiteTools } from "./site-tools.js";
import { createSerialQueue } from "./tool-helpers.js";
import type { PageTool, PageToolContext } from "./types.js";

/**
 * The page tools: one set that outside agents (through MCP, on a saved page) and the
 * in-editor assistant (on the copy open in the editor) both use. They differ only in where
 * the page lives, which is why the tools take `readTree` / `writeTree` instead of a page.
 *
 * Tools that change the page run one after another, so two calls sent at once never start
 * from the same page. Site tools (`list_media`, `list_pages`, `list_template_parts`,
 * `get_theme`) are included only when the host gave the matching lookup.
 */
export const createPageTools = (ctx: PageToolContext): PageTool[] => {
	const queue = createSerialQueue();
	const [outline, getBlock, listTypes, getType] = createReadTools(ctx);
	const [checkPageTool, phoneFixes] = createCheckTools({ ctx, queue });
	return [
		outline,
		getBlock,
		listTypes,
		getType,
		createChangeBlocksTool({ ctx, queue }),
		checkPageTool,
		phoneFixes,
		createDesignGuideTool(ctx),
		...createSiteTools(ctx),
	];
};
