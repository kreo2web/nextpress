/**
 * Everything an AI agent needs to read and change a page: a short outline, a page check, a
 * block builder that takes a plain description, the page design guide, and the page tools
 * (one set for outside agents over MCP and for an in-editor assistant). All pure: no network.
 * The code is shared with the editor and the server and reaches the SDK through one bridge.
 */
export {
	type BlockSpec,
	buildBlockFromSpec,
	type BuildFromSpecParams,
	type CheckPageResult,
	checkPage,
	createBlockSpecSchema,
	createPageTools,
	type MediaSummary,
	type OutlinePageParams,
	outlinePage,
	PAGE_DESIGN_GUIDE,
	type PageProblem,
	type PageProblemKind,
	type PageSummary,
	type PageTool,
	type PageToolContext,
	type PageToolResult,
	type SiteLookups,
	type TemplatePartSummary,
	type ThemeSummary,
	type ToolErrorReport,
	type TreeChange,
	type TreeChangeSummary,
	type WriteTreeResult,
} from "../blocks/shared-page-tools.js";
