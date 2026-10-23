import { createBlockSpecSchema, type BlockSpec } from "@nextpress-org/sdk";
import { z } from "zod";
import { buildBlocksFromSpecs } from "../build-blocks.js";
import { formatJson, runTool } from "../format-result.js";
import type { ToolDeps } from "./tool-deps.js";

/**
 * Block builder for new pages and template parts. The block type list (`list_block_types`)
 * lives with the page-editing tools, because it carries a note on when to use each block.
 */
export function registerBlockTools({ server }: ToolDeps): void {
	server.registerTool(
		"build_blocks",
		{
			title: "Build blocks",
			description:
				'Turns block descriptions into ready-made blocks for create_page or create_template_part. A block is { name, label?, content?, styles?, children? }, the same shape change_page_blocks takes: it starts exactly as the editor would insert it, then your content and styles are laid over that. get_block_type lists a block\'s content fields; other fields are refused. To add to or change a page that already exists, use change_page_blocks instead: it also checks the page.',
			inputSchema: {
				blocks: z.array(createBlockSpecSchema()).min(1).describe("The blocks, in page order."),
			},
		},
		async ({ blocks }) => runTool(async () => formatJson({ blocks: buildBlocksFromSpecs(blocks as BlockSpec[]) })),
	);
}
