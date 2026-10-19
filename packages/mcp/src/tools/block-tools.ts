import { buildBlocksFromNodes, type BlockBuildNode } from "../build-blocks.js";
import { formatJson, runTool } from "../format-result.js";
import { blockBuildNodeSchema, type ToolDeps } from "./tool-deps.js";

/**
 * SDK block builder. The block type list (`list_block_types`) lives with the page-editing
 * tools, because it carries a note on when to use each block.
 */
export function registerBlockTools({ server, client }: ToolDeps): void {
	server.registerTool(
		"build_blocks",
		{
			title: "Build blocks",
			description:
				"Convert structured block nodes into BlockConfig[] via SDK helpers, for create_page or create_template_part. To add to or change a page that already exists, use change_page_blocks instead: it fills in each block's defaults and checks the result.",
			inputSchema: {
				blocks: blockBuildNodeSchema.array().min(1),
			},
		},
		async ({ blocks }) =>
			runTool(async () => {
				const built = buildBlocksFromNodes({
					blocks: blocks as BlockBuildNode[],
					builder: client.blocks,
				});
				return formatJson({ blocks: built });
			}),
	);
}
