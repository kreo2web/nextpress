/**
 * The shared page tools name each other in their descriptions and replies ("call get_block",
 * "apply_phone_fixes fixes them"). MCP exposes three of them under page-scoped names, so the
 * text is rewritten to the names the agent can actually call.
 */
const MCP_NAMES: Record<string, string> = {
	get_block: "get_page_block",
	change_blocks: "change_page_blocks",
	apply_phone_fixes: "apply_page_phone_fixes",
};

const SHARED_NAME_PATTERN = /\b(get_block|change_blocks|apply_phone_fixes)\b/g;

/** Rewrites shared tool names to their MCP names. `get_block_type` is left alone (the word stops at `_`). */
export function toMcpText(text: string): string {
	return text.replace(SHARED_NAME_PATTERN, (name) => MCP_NAMES[name] ?? name);
}
