import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createNextpress, type NextpressClient } from "@nextpress-org/sdk";
import { createMcpServer } from "../create-mcp-server.js";
import { SITE_ID, type FakeApi } from "./fake-nextpress-api.js";

export type LinkedSession = {
	client: Client;
	close: () => Promise<void>;
};

/** The real SDK client, talking to a fake server through `fetch`. */
export const createSdkOverFakeApi = (api: FakeApi): NextpressClient =>
	createNextpress({
		baseUrl: "https://cms.example.com",
		apiKey: "npk_live_test",
		siteId: SITE_ID,
		fetch: api.fetch,
	});

/** A real MCP client linked to the real MCP server in memory. */
export async function connectMcpSession(sdkClient: NextpressClient): Promise<LinkedSession> {
	const mcpServer = createMcpServer({ client: sdkClient });
	const mcpClient = new Client({ name: "mcp-test", version: "0.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

	await Promise.all([mcpClient.connect(clientTransport), mcpServer.server.connect(serverTransport)]);

	return {
		client: mcpClient,
		close: async () => {
			await mcpClient.close();
			await mcpServer.close();
		},
	};
}

type ToolContent = { content: Array<{ type: string; text?: string }> };

/** The text of a tool's first text block. */
export function textPayload(result: ToolContent): string {
	return result.content.find((item) => item.type === "text")?.text ?? "";
}

type ResourceContents = { contents: Array<{ uri: string; text?: string; blob?: string }> };

/** The text of a resource's first block. */
export function resourceText(resource: ResourceContents): string {
	return resource.contents[0]?.text ?? "";
}
