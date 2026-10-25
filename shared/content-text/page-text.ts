import { readDocsListContent, shownListItems } from "../blocks/docs-list-model.js";
import { UPDATE_BLOCK_NAME } from "../blocks/update-model.js";
import { readDocsTextContent } from "../blocks/docs-text-model.js";
import { readParamsContent, shownParams } from "../blocks/params-model.js";
import { inlineMarkdownToText } from "../markdown/inline-text.js";
import { collectHeadingsFromBlocks } from "../page-headings.js";
import { readBlockContentData } from "../read-block-content.js";
import { readMarkdownHeadings } from "../markdown/headings.js";
import { type MarkdownNode, parseMarkdown } from "../markdown/parse-markdown.js";
import { markdownToPlainText } from "../markdown/plain-text.js";
import type { BlockConfig } from "../schema-types.js";
import { type BlockData, listItemsFromHtml, readList, readString, stripHtml } from "./html-text.js";

export type PageHeadingText = { text: string; id: string; depth: number };

/** The words under one heading (or before the first one, where `id` and `heading` are empty). */
export type PageSection = { id: string; heading: string; text: string };

export type PageText = {
	headings: PageHeadingText[];
	/** Everything a reader can read, headings included, one block per line. */
	text: string;
	/** `text` split at each heading, so a search hit can link to its section. */
	sections: PageSection[];
};

const HEADING_BLOCKS = new Set(["core/heading", "post/title", "docs/heading"]);
/** Blocks that carry nothing a reader reads as page text (code that runs, forms, menus, hidden popups). */
const SILENT_BLOCKS = new Set(["core/html", "core/spacer", "core/separator", "core/divider", "core/icon", "core/header", "core/popup", "core/form", "core/template-part", "core/search"]);

type Collector = {
	headings: PageHeadingText[];
	sections: { id: string; heading: string; lines: string[] }[];
};

const startSection = ({ collector, id, heading }: { collector: Collector; id: string; heading: string }): void => {
	collector.sections.push({ id, heading, lines: [heading] });
};

const addLines = ({ collector, lines }: { collector: Collector; lines: string[] }): void => {
	const clean = lines.map((line) => line.trim()).filter(Boolean);
	if (clean.length === 0) return;
	if (collector.sections.length === 0) collector.sections.push({ id: "", heading: "", lines: [] });
	collector.sections[collector.sections.length - 1].lines.push(...clean);
};

const hasHeadingBelow = (node: MarkdownNode): boolean =>
	(node.children ?? []).some((child) => child.type === "heading" || hasHeadingBelow(child));

/** Markdown (or MDX when `mdx`) read into the collector, with the anchors the page gives its headings. */
const addMarkdown = ({ collector, source, mdx }: { collector: Collector; source: string; mdx: boolean }): void => {
	const parsed = parseMarkdown({ text: source, mdx });
	const fallback = !parsed.ok && mdx ? parseMarkdown({ text: source }) : parsed;
	if (!fallback.ok) return addLines({ collector, lines: [source] });
	const pending = readMarkdownHeadings(fallback.tree);
	const visit = (node: MarkdownNode): void => {
		if (node.type === "heading") {
			const heading = pending.shift();
			if (!heading) return;
			collector.headings.push({ text: heading.text, id: heading.id, depth: heading.depth });
			startSection({ collector, id: heading.id, heading: heading.text });
			return;
		}
		if (hasHeadingBelow(node)) {
			node.children?.forEach(visit);
			return;
		}
		addLines({ collector, lines: [markdownToPlainText({ type: "root", children: [node] })] });
	};
	visit(fallback.tree);
};

const tableLines = (data: BlockData): string[] =>
	["head", "body", "foot"].flatMap((part) =>
		readList(data[part]).map((row) =>
			readList(row.cells)
				.map((cell) => stripHtml(readString(cell.content)))
				.filter(Boolean)
				.join(" "),
		),
	);

/** The own words of a block that is not a heading or markdown. */
const ownLines = ({ block, data }: { block: BlockConfig; data: BlockData }): string[] => {
	const name = block.name;
	if (name === "core/list") return listItemsFromHtml(readString(data.values));
	if (name === "docs/text") return [inlineMarkdownToText(readDocsTextContent(block.content).text)];
	if (name === "docs/list") return shownListItems(readDocsListContent(block.content).items).flatMap((item) => [item, ...item.children]).map((item) => inlineMarkdownToText(item.text));
	if (name === "core/table") return [stripHtml(readString(data.caption)), ...tableLines(data)];
	if (name === "core/code" || name === "core/preformatted") return [readString(data.content), stripHtml(readString(data.title))];
	if (name === "core/quote" || name === "core/pullquote") return [stripHtml(readString(data.value)), stripHtml(readString(data.citation))];
	if (name === "core/image") return [stripHtml(readString(data.alt)), stripHtml(readString(data.caption))];
	if (name === "core/button") return [stripHtml(readString(data.value))];
	if (name === "docs/file-tree") return [readString(data.tree).replace(/[/*]|#/g, " ")];
	if (name === "docs/diagram") return [readString(data.code), stripHtml(readString(data.caption))];
	if (name === "docs/params") return shownParams(readParamsContent(block.content).items).flatMap((item) => [item.name, item.type, item.description]);
	const titled = readString(data.title);
	return [stripHtml(readString(data.value)), stripHtml(readString(data.content)), stripHtml(readString(data.text)), stripHtml(titled)];
};

const walk = ({ blocks, collector }: { blocks: BlockConfig[]; collector: Collector }): void => {
	blocks.forEach((block) => {
		if (SILENT_BLOCKS.has(block.name)) return;
		const data = readBlockContentData(block.content) as BlockData;
		if (block.name === UPDATE_BLOCK_NAME) {
			// An entry is a section under its label (the link the contents list gives), and its blocks follow it.
			const entry = collectHeadingsFromBlocks([{ ...block, children: [] }])[0];
			if (entry) {
				collector.headings.push({ text: entry.text, id: entry.id, depth: entry.level });
				startSection({ collector, id: entry.id, heading: entry.text });
			}
			addLines({ collector, lines: [stripHtml(readString(data.description))] });
			walk({ blocks: block.children ?? [], collector });
			return;
		}
		if (HEADING_BLOCKS.has(block.name)) {
			const heading = collectHeadingsFromBlocks([{ ...block, children: [] }])[0];
			if (heading) {
				collector.headings.push({ text: heading.text, id: heading.id, depth: heading.level });
				startSection({ collector, id: heading.id, heading: heading.text });
			}
			return;
		}
		if (block.name === "core/markdown") {
			addMarkdown({ collector, source: readString(data.content) || readString(data.value), mdx: data.mdx === true });
			return;
		}
		addLines({ collector, lines: ownLines({ block, data }) });
		if (block.children?.length) walk({ blocks: block.children, collector });
	});
};

/**
 * Everything a reader can read on a page, as plain text with its headings: the one input to the
 * site search and to short summaries.
 * Heading anchors are the ones the page itself gives, so a result can link straight to a section.
 */
export const extractPageText = (blocks: BlockConfig[]): PageText => {
	const collector: Collector = { headings: [], sections: [] };
	walk({ blocks, collector });
	const sections = collector.sections
		.map((section) => ({ id: section.id, heading: section.heading, text: section.lines.join("\n") }))
		.filter((section) => section.text.trim() !== "");
	return { headings: collector.headings, text: sections.map((section) => section.text).join("\n"), sections };
};
