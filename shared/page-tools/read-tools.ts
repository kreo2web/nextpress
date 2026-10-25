import { z } from "zod";
import { resolveBlockName } from "../block-catalog/block-names.js";
import { BLOCK_CATALOG, getBlockEntry } from "../block-catalog/entries.js";
import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import { PAGE_DESIGN_GUIDE } from "../block-catalog/page-design-guide.js";
import type { BlockCatalogEntry } from "../block-catalog/types.js";
import { describeContentFields } from "./content-fields.js";
import { outlinePage } from "./outline-page.js";
import { defineTool, readPageTree } from "./tool-helpers.js";
import { countBlocks, findBlockById } from "./tree-find.js";
import type { PageTool, PageToolContext } from "./types.js";

/** Pages with more blocks than this fold their deepest levels in the outline. */
const BIG_PAGE_BLOCKS = 400;
const BIG_PAGE_OUTLINE_DEPTH = 3;
/** A single block bigger than this (as JSON text) is read as an outline of its children. */
const MAX_BLOCK_JSON_CHARS = 20_000;

/** A block's group for an agent: `docs`, or `advanced (also docs)` when another group lists it too. */
const describeCategory = (entry: BlockCatalogEntry): string =>
	entry.alsoIn && entry.alsoIn.length > 0 ? `${entry.category} (also ${entry.alsoIn.join(", ")})` : entry.category;

const createOutlineTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "get_page_outline",
			title: "Page outline",
			description:
				'Read this first. Returns a short outline of the whole page: one indented line per block with its name (no "core/", and change_blocks takes it that way too), its id, a custom label if it has one, and the key content (first words of text, heading level, button link, picture and alt text, stack type, header variant, popup slug, form field name). Use it to find the ids that get_block and change_blocks need, and read it again after anything changed the page. A line marked "← selected" is the block the person picked. Very large pages fold their deepest levels as "(+N inside)"; read those with get_block. It does not show styles or settings.',
			inputShape: {},
			changesPage: false,
			run: async () => {
				const read = await readPageTree(ctx);
				if (!read.ok) return read.result;
				const total = countBlocks(read.blocks);
				const folded = total > BIG_PAGE_BLOCKS;
				const focusId = ctx.focusBlockId ?? null;
				const header = [
					`Page: ${total} block${total === 1 ? "" : "s"}.`,
					focusId && findBlockById({ blocks: read.blocks, id: focusId })
						? `Selected block: id ${focusId}. Changes are limited to it and what is inside it.`
						: focusId
							? `The selected block (id ${focusId}) is no longer on the page.`
							: "",
					folded ? `Deep blocks are folded; use get_block on an id to read inside one.` : "",
				].filter(Boolean);
				const outline = outlinePage({
					blocks: read.blocks,
					focusBlockId: focusId,
					maxDepth: folded ? BIG_PAGE_OUTLINE_DEPTH : undefined,
				});
				return { ok: true, text: `${header.join(" ")}\n${outline}` };
			},
		},
	});

const createGetBlockTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "get_block",
			title: "Read a block",
			description:
				"Returns one block in full as JSON: its content, styles, settings and children. Use it when the outline is not enough, for example to see the exact styles before changing them. Pass an id from get_page_outline. A very large block (many nested blocks) comes back without its children, which are listed as an outline instead; call get_block again on a child to read it.",
			inputShape: { id: z.string().min(1).describe("Id of the block, from get_page_outline.") },
			changesPage: false,
			run: async ({ id }) => {
				const read = await readPageTree(ctx);
				if (!read.ok) return read.result;
				const block = findBlockById({ blocks: read.blocks, id });
				if (!block) return { ok: false, text: `No block with id ${id}. Read the outline again.` };
				const full = JSON.stringify(block);
				if (full.length <= MAX_BLOCK_JSON_CHARS) return { ok: true, text: full };
				const { children, ...rest } = block;
				return {
					ok: true,
					text: [
						`This block is large (${countBlocks([block])} blocks including its children), so its children are cut from the JSON below and listed as an outline. Call get_block on a child id to read it in full.`,
						JSON.stringify(rest),
						"Children:",
						outlinePage({ blocks: children ?? [], maxText: 40, maxDepth: 2 }),
					].join("\n"),
				};
			},
		},
	});

const createListTypesTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "list_block_types",
			title: "Block types",
			description:
				"Lists every block type you can add: name, label, kind (block = holds no other blocks, container = holds blocks), category, and a note on when to use it. Docs blocks are named docs/… and keep that prefix when you use them; a block that another group lists too shows \"(also docs)\". Use it to pick the right block for a section. For one block's fields and an example, call get_block_type.",
			inputShape: {},
			changesPage: false,
			run: async () => ({
				ok: true,
				text: BLOCK_CATALOG.map(
					(entry) => `${entry.name} | ${entry.label} | ${entry.kind} | ${describeCategory(entry)} | ${entry.agentNote}`,
				).join("\n"),
			}),
		},
	});

const createGetBlockTypeTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "get_block_type",
			title: "Block type details",
			description:
				'Returns one block type in full: label, description, kind, category, where it may sit, the note on when to use it, its content fields (send them under "content" in change_blocks; no other field is accepted), and an example block exactly as the editor inserts it (default content, styles and starting children). Use it before you build a block you have not used yet.',
			inputShape: { name: z.string().min(1).describe("Block name, such as stack or core/stack.") },
			changesPage: false,
			run: async ({ name }) => {
				const resolved = resolveBlockName(name);
				if (!resolved.ok) return { ok: false, text: resolved.message };
				const entry = getBlockEntry(resolved.name);
				let counter = 0;
				const example = createDefaultBlock({
					name: entry.name,
					id: "example-1",
					newId: () => `example-${++counter + 1}`,
				});
				return {
					ok: true,
					text: [
						`${entry.name}: ${entry.label}. ${entry.description}`,
						`Kind: ${entry.kind}${entry.kind === "container" ? " (can hold other blocks)" : " (cannot hold other blocks)"}. Category: ${describeCategory(entry)}.`,
						entry.placement?.rootOnly ? "Placement: page root only, one per page." : "",
						`When to use: ${entry.agentNote}`,
						`Content fields: ${describeContentFields(entry.name)}`,
						`Example (what a new one looks like; ids are made up):`,
						JSON.stringify(example),
					]
						.filter(Boolean)
						.join("\n"),
				};
			},
		},
	});

const createDesignGuideTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "get_design_guide",
			title: "Design guide",
			description:
				"Returns the guide to building a good NextPress page: page shape, words, colours and type, spacing, phone rules, pictures and links. Read it once before building a new page or section, and follow it.",
			inputShape: {},
			changesPage: false,
			run: async () => ({ ok: true, text: PAGE_DESIGN_GUIDE }),
		},
	});

/** The tools that only read: outline, one block, block types, the design guide. */
export const createReadTools = (ctx: PageToolContext): PageTool[] => [
	createOutlineTool(ctx),
	createGetBlockTool(ctx),
	createListTypesTool(ctx),
	createGetBlockTypeTool(ctx),
];

export { createDesignGuideTool };
