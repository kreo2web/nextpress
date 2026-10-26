import { DIAGRAM_BLOCK_NAME, readDiagramContent } from "../blocks/diagram-model.js";
import { readDocsHeadingContent } from "../blocks/docs-heading-model.js";
import { readDocsListContent } from "../blocks/docs-list-model.js";
import { readDocsTextContent } from "../blocks/docs-text-model.js";
import { type BlockData, inlineMarkdown, listItemsAsMarkdown, type Loose, readList, readString, stripHtml } from "../content-text/html-text.js";
import { MDX_ELEMENT_BLOCKS, MDX_FALLBACK_BLOCK_NAME } from "./block-names.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import { docsListToMdx } from "./docs-list-mdx.js";
import { dataOf } from "./write-data.js";
import { escapeText, fenced, fenceTitle, oneLine, type BlockWriter } from "./write-text.js";

/** Text that would read as a list, quote, heading or code if it sat at the start of a line. */
const STARTS_AS_BLOCK = /^(?:[#>+*-](?:\s|$)|\d+[.)](?:\s|$)|```|~~~|\|)/;

/** A paragraph's text, escaped where it would otherwise start a list, quote, heading or code. */
export const paragraphToMdx = (text: string): string => {
	const flat = text.trim().replace(/\n{2,}/g, "\n");
	return STARTS_AS_BLOCK.test(flat) ? `\\${flat}` : flat;
};

/** A heading level a docs heading can take (2 to 4); anything else is a level 2 heading. */
const headingHashes = (value: Loose): string => {
	const level = typeof value === "number" && value >= 2 && value <= 4 ? Math.round(value) : 2;
	return "#".repeat(level);
};

/** A code block's info line and body: the language (or `text` when the code has a title or marks but no language), the marked lines, the title and the line numbers. */
const codeFence = (data: BlockData): string => {
	const language = readString(data.language).replace(/[^A-Za-z0-9+#._-]/g, "");
	const highlight = readString(data.highlightLines)
		.split(/[\s,]+/)
		.filter((part) => /^\d+(-\d+)?$/.test(part))
		.join(",");
	const title = readString(data.title);
	const showLineNumbers = data.showLineNumbers === true;
	const needsLanguage = title !== "" || highlight !== "" || showLineNumbers;
	const info = [language || (needsLanguage ? "text" : ""), highlight ? `{${highlight}}` : "", title ? fenceTitle(title) : "", showLineNumbers ? "showLineNumbers" : ""]
		.filter(Boolean)
		.join(" ");
	return fenced({ info, code: readString(data.content) });
};

/** A GFM table: the first row is the header, the rest are body rows, with the foot's rows after the body. */
const tableMarkdown = (data: BlockData): string => {
	const rowsOf = (part: string): string[][] =>
		readList(data[part]).map((row) => readList(row.cells).map((cell) => escapeText(stripHtml(readString(cell.content)))));
	const head = rowsOf("head");
	const body = [...rowsOf("body"), ...rowsOf("foot")];
	const header = head[0] ?? body.shift();
	if (!header) return "";
	const line = (row: string[]): string => `| ${header.map((_, index) => row[index] ?? "").join(" | ")} |`;
	return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...[...head.slice(1), ...body].map(line)].join("\n");
};

/** An image on its own line. A caption has no markdown form and is not written. */
const imageMarkdown = (data: BlockData): string => {
	const url = readString(data.url).trim();
	if (!url) return "";
	const destination = /[\s()<>]/.test(url) ? `<${url}>` : url;
	const alt = oneLine(readString(data.alt)).replace(/[\\[\]]/g, "\\$&");
	const title = oneLine(readString(data.title));
	return `![${alt}](${destination}${title ? ` "${title.replace(/["\\]/g, "\\$&")}"` : ""})`;
};

/** A quote as `> ` lines, one paragraph after another, with its citation last. Its HTML is read as plain text. */
const quoteMarkdown = (data: BlockData): string => {
	const paragraphs = readString(data.value)
		.split(/<\/p>/i)
		.map((part) => stripHtml(part))
		.filter((text) => text !== "");
	const lines = paragraphs.map((text) => text.split("\n").map((line) => `> ${escapeText(line)}`).join("\n"));
	const citation = stripHtml(readString(data.citation));
	return [...lines, ...(citation ? [`> — ${escapeText(citation)}`] : [])].join("\n>\n");
};

const docsHeadingWriter: BlockWriter = ({ block }) => {
	const { level, text } = readDocsHeadingContent(block.content);
	const words = oneLine(text);
	return `${"#".repeat(level)}${words ? ` ${words}` : ""}`;
};

const docsTextWriter: BlockWriter = ({ block }) => paragraphToMdx(readDocsTextContent(block.content).text);

const docsListWriter: BlockWriter = ({ block }) => docsListToMdx(readDocsListContent(block.content));

const coreParagraphWriter: BlockWriter = ({ block }) => paragraphToMdx(inlineMarkdown(readString(dataOf(block).value)));

const coreHeadingWriter: BlockWriter = ({ block }) => {
	const data = dataOf(block);
	const words = oneLine(inlineMarkdown(readString(data.value)));
	return words ? `${headingHashes(data.level)} ${words}` : "";
};

const coreListWriter: BlockWriter = ({ block }) => {
	const data = dataOf(block);
	const ordered = data.ordered === true;
	return listItemsAsMarkdown(readString(data.values))
		.map((item, index) => `${ordered ? `${index + 1}.` : "-"} ${oneLine(item)}`)
		.join("\n");
};

const coreCodeWriter: BlockWriter = ({ block }) => codeFence(dataOf(block));

/** A diagram as a ```` ```mermaid ```` fence, with its caption as the fence's title. */
const diagramWriter: BlockWriter = ({ block }) => {
	const { code, caption } = readDiagramContent(block.content);
	return fenced({ info: ["mermaid", caption.trim() ? fenceTitle(caption) : ""].filter(Boolean).join(" "), code });
};

const coreTableWriter: BlockWriter = ({ block }) => tableMarkdown(dataOf(block));

const coreImageWriter: BlockWriter = ({ block }) => imageMarkdown(dataOf(block));

const coreSeparatorWriter: BlockWriter = () => "---";

const coreQuoteWriter: BlockWriter = ({ block }) => quoteMarkdown(dataOf(block));

/** A markdown block (MDX on) is written exactly as it was read: the words are its content. */
const markdownWriter: BlockWriter = ({ block }) => {
	const data = dataOf(block);
	return (typeof data.content === "string" ? data.content : typeof data.value === "string" ? data.value : "").trim();
};

/** Element blocks, by name: each writes the one MDX element it is read from. */
export const ELEMENT_WRITERS: ReadonlyArray<[string, BlockWriter]> = [
	[MDX_ELEMENT_BLOCKS.heading, docsHeadingWriter],
	[MDX_ELEMENT_BLOCKS.paragraph, docsTextWriter],
	[MDX_ELEMENT_BLOCKS.list, docsListWriter],
	[MDX_FALLBACK_BLOCK_NAME, markdownWriter],
	[CORE_BLOCK_NAMES.paragraph, coreParagraphWriter],
	[CORE_BLOCK_NAMES.heading, coreHeadingWriter],
	[CORE_BLOCK_NAMES.list, coreListWriter],
	[CORE_BLOCK_NAMES.code, coreCodeWriter],
	[DIAGRAM_BLOCK_NAME, diagramWriter],
	[CORE_BLOCK_NAMES.table, coreTableWriter],
	[CORE_BLOCK_NAMES.image, coreImageWriter],
	[CORE_BLOCK_NAMES.separator, coreSeparatorWriter],
	[CORE_BLOCK_NAMES.quote, coreQuoteWriter],
];
