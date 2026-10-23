import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NextpressClient } from "@nextpress-org/sdk";

export type ToolDeps = {
	server: McpServer;
	client: NextpressClient;
};
