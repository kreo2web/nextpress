import {
	TEMPLATE_ROOT_BLOCK_NAMES,
	type BlockConfig,
	type CreateTemplatePartInput,
} from "@nextpress-org/sdk";
import { z } from "zod";
import { formatJson, runTool } from "../format-result.js";
import type { ToolDeps } from "./tool-deps.js";

const PAGE_SHELL = "core/page-shell";

/** The layout block a part is made of, looking inside the page shell the editor wraps it in. */
const readRootBlock = (blocks: BlockConfig[] | null | undefined): string | null => {
	const top = blocks ?? [];
	const inner = top.length === 1 && top[0]?.name === PAGE_SHELL ? (top[0].children ?? []) : top;
	return inner[0]?.name ?? null;
};

const HOW_TO_USE =
	'To show this part on a page, insert a core/template-part block with content {"templateId": "<id>"} using change_page_blocks.';

/** Shared headers, footers and sections that many pages show from one place. */
export function registerTemplatePartTools({ server, client }: ToolDeps): void {
	server.registerTool(
		"list_template_parts",
		{
			title: "List template parts",
			description:
				'Lists this site\'s template parts: a header, footer or section designed once and shown on many pages. Each has its id, name, root block and usedOnPages (how many pages show it). Use it before building a header or footer, and reuse a part that exists instead of building the same thing again. To show one on a page, insert a core/template-part block with content {"templateId": "<id>"} using change_page_blocks. A part is shared: changing it changes every page that uses it. (list_templates is different: those are ready-made blocks that get copied into a page.)',
			inputSchema: {
				page: z.number().int().min(1).optional(),
				per_page: z.number().int().min(1).max(100).optional(),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) =>
			runTool(async () => {
				const result = await client.templates.listParts(args);
				return formatJson({
					parts: result.templates.map((part) => ({
						id: part.id,
						name: part.name,
						rootBlock: readRootBlock(part.blocks),
						usedOnPages: part.usedOnPages,
					})),
					total: result.total,
					page: result.page,
					total_pages: result.total_pages,
				});
			}),
	);

	server.registerTool(
		"create_template_part",
		{
			title: "Create template part",
			description: `Creates a template part on this site: one layout block (${TEMPLATE_ROOT_BLOCK_NAMES.join(", ")}) with anything inside it. Send either blocks (exactly one such block with its children, for example from build_blocks) or rootBlock to start from an empty one; not both. With neither it starts as an empty core/group. Returns the part's id. ${HOW_TO_USE} Creating a part does not change any page.`,
			inputSchema: {
				name: z.string().min(1).describe('A name people will recognise, such as "Main header"'),
				rootBlock: z
					.enum(TEMPLATE_ROOT_BLOCK_NAMES)
					.optional()
					.describe("Start from an empty block of this kind. Leave out when sending blocks."),
				blocks: z
					.array(z.record(z.unknown()))
					.optional()
					.describe("Ready-made content: exactly one layout block with everything inside it."),
			},
		},
		async ({ name, rootBlock, blocks }) =>
			runTool(async () => {
				const part = await client.templates.createPart({
					name,
					rootBlock,
					blocks: blocks as CreateTemplatePartInput["blocks"],
				});
				return formatJson({
					id: part.id,
					name: part.name,
					rootBlock: readRootBlock(part.blocks),
					howToUse: HOW_TO_USE,
				});
			}),
	);

	server.registerTool(
		"get_template_part_usage",
		{
			title: "Template part usage",
			description:
				"Lists the pages that show a template part (drafts included, trashed pages not). Call it before changing or removing a part, because every page listed changes with it. Returns each page's id, title and status. A ready-made template (list_templates) is copied into pages, so it returns no pages.",
			inputSchema: { id: z.string().uuid().describe("Template part id, from list_template_parts") },
			annotations: { readOnlyHint: true },
		},
		async ({ id }) =>
			runTool(async () => {
				const { pages } = await client.templates.usage({ id });
				return formatJson({ id, pageCount: pages.length, pages });
			}),
	);
}
