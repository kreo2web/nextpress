import { randomUUID } from "node:crypto";
import { models } from "./storage.js";
import { ensureRootPageShell } from "@shared/page-shell-model";
import type { BlockConfig, BlockContent } from "@shared/schema-types";
import { isTemplatePart } from "@shared/template-usage";
import { createDefaultBlock } from "@shared/block-catalog";
import { DOCS_LAYOUT_BLOCK_NAME } from "@shared/blocks/docs-layout-model";

/** Builds a minimal starter layout editors can extend. */
function buildStarterBlocks({ kind }: { kind: "page" | "post" }): BlockConfig[] {
	const headingId = randomUUID();
	const paragraphId = randomUUID();
	const buttonId = randomUUID();

	const title =
		kind === "page" ? "Welcome to your page" : "Your post title";
	const body =
		kind === "page"
			? "Replace this starter layout with your own blocks, or edit it in place."
			: "Start writing your post. This layout comes from the default post template.";

	// Same shape the button block reads: text content plus its link.
	const buttonContent: BlockContent & { url: string; linkTarget: "_self" } = {
		kind: "text",
		value: kind === "page" ? "Get started" : "Read more",
		url: "#",
		linkTarget: "_self",
	};

	const starter: BlockConfig[] = [
		{
			id: headingId,
			name: "core/heading",
			label: "Heading",
			type: "block",
			parentId: null,
			category: "basic",
			content: { kind: "text", value: title },
			styles: { padding: "20px", margin: "0px", fontSize: "2rem", fontWeight: "700" },
			settings: {},
			other: {
				tokenMap: {},
				units: { spacing: "px", font: "rem", dimension: "px", border: "px" },
			},
		},
		{
			id: paragraphId,
			name: "core/paragraph",
			label: "Paragraph",
			type: "block",
			parentId: null,
			category: "basic",
			content: { kind: "text", value: body },
			styles: { padding: "20px", margin: "0px" },
			settings: {},
			other: {
				tokenMap: {},
				units: { spacing: "px", font: "rem", dimension: "px", border: "px" },
			},
		},
		{
			id: buttonId,
			name: "core/button",
			label: "Button",
			type: "block",
			parentId: null,
			category: "basic",
			content: buttonContent,
			styles: {
				padding: "20px",
				margin: "0px",
				backgroundColor: "var(--npb-accent)",
				color: "var(--npb-text-inverse)",
			},
			settings: {},
			other: {
				tokenMap: {},
				units: { spacing: "px", font: "rem", dimension: "px", border: "px" },
			},
		},
	];
	return ensureRootPageShell({
		blocks: starter,
		shellId: randomUUID(),
	}).blocks;
}

const DOCS_STARTER_MARKDOWN = [
	"# Page title",
	"",
	"A sentence or two on what this page helps the reader do.",
	"",
	"## Install",
	"",
	"```bash",
	"npm install your-package",
	"```",
	"",
	'<Callout type="tip" title="Good to know">Keep each page about one thing. Link to the next page when the reader is ready for it.</Callout>',
	"",
	"## Next steps",
	"",
	"Say where to go from here.",
].join("\n");

/** A docs page: the docs layout (sidebar, contents, previous/next) around one markdown block. */
function buildDocsBlocks(): BlockConfig[] {
	const layoutId = randomUUID();
	const layout = createDefaultBlock({ name: DOCS_LAYOUT_BLOCK_NAME, id: layoutId, newId: randomUUID });
	const markdown = createDefaultBlock({ name: "core/markdown", id: randomUUID(), newId: randomUUID });
	if (!layout || !markdown) throw new Error("Block catalog is missing the docs layout or markdown block.");
	const starter: BlockConfig = {
		...markdown,
		parentId: layoutId,
		content: { kind: "structured", data: { content: DOCS_STARTER_MARKDOWN, mdx: true, className: "" } },
	};
	return ensureRootPageShell({ blocks: [{ ...layout, children: [starter] }], shellId: randomUUID() }).blocks;
}

/**
 * Seeds starter page/post templates when none exist (setup wizard or CLI upgrade).
 */
export async function initializeDefaultTemplates({
	authorId,
}: {
	authorId: string;
}): Promise<void> {
	// Linked template parts do not count: a site that only has parts still gets the starter blocks.
	const existing = (await models.templates.findMany()).filter((row) => !isTemplatePart(row.other));
	if (existing.length > 0) {
		return;
	}

	const pageTemplate = await models.templates.create({
		name: "Basic Page",
		type: "page",
		description: "Heading, paragraph, and call-to-action — a simple starting layout for pages.",
		authorId,
		blocks: buildStarterBlocks({ kind: "page" }),
		settings: {},
	});

	const postTemplate = await models.templates.create({
		name: "Basic Post",
		type: "post",
		description: "Title, intro paragraph, and button — a simple starting layout for blog posts.",
		authorId,
		blocks: buildStarterBlocks({ kind: "post" }),
		settings: {},
	});

	const docsTemplate = await models.templates.create({
		name: "Docs Page",
		type: "page",
		description: "Sidebar of pages, contents list, and previous/next links around a markdown page — for documentation.",
		authorId,
		blocks: buildDocsBlocks(),
		settings: {},
	});

	console.log("Default templates initialized:", pageTemplate.name, postTemplate.name, docsTemplate.name);
}
