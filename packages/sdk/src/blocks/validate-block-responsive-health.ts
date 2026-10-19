/**
 * The phone check is the one the editor uses, so SDK and MCP callers see the same warnings and
 * the same one-click fixes. See `shared-catalog.ts` for why it is re-exported from there.
 */
export {
	applyResponsiveHealthFixes,
	type ResponsiveHealthIssue,
	type ResponsiveHealthResult,
	validateBlockResponsiveHealth,
} from "./shared-catalog.js";
