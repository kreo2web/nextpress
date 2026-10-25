import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NextpressClient } from "@nextpress-org/sdk";
import { registerContentPrompts } from "./prompts/register-content-prompts.js";
import { registerContentResources } from "./resources/register-content-resources.js";
import { registerContentTools } from "./tools/register-content-tools.js";

export const MCP_SERVER_NAME = "nextpress";
export const MCP_SERVER_VERSION = "0.3.0";

/**
 * What a client shows the agent when it connects: where to start and the order that works.
 * Tool descriptions say how each tool behaves; this says which ones to reach for.
 */
const SERVER_INSTRUCTIONS = `NextPress CMS. Pages are trees of blocks; the owner reviews your work in the dashboard.
To build or change a page: read it with get_page_outline, look up blocks with list_block_types and get_block_type, change it in small steps with change_page_blocks (each reply checks the page), then run preview_page. New pages stay drafts; publish only when the owner asks.
The build_page prompt and the nextpress://design-guide resource hold the full guide. get_page_history and restore_page_version undo a bad change.
To write docs pages, use the write_docs prompt or the nextpress://docs/guide resource (get_docs_guide returns the same text).`;

/**
 * Create the NextPress MCP server with content-core tools, resources and prompts.
 * No business logic here — tools map straight to the SDK client.
 */
export function createMcpServer({ client }: { client: NextpressClient }): McpServer {
	const server = new McpServer(
		{
			name: MCP_SERVER_NAME,
			version: MCP_SERVER_VERSION,
		},
		{ instructions: SERVER_INSTRUCTIONS },
	);

	registerContentTools({ server, client });
	registerContentResources({ server, client });
	registerContentPrompts({ server });

	return server;
}
