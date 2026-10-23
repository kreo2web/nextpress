import { collectHeadingsFromBlocks } from "../page-headings.js";
import { readBlockContentData } from "../read-block-content.js";
import type { BlockConfig } from "../schema-types.js";
import { type BlockData, inlineMarkdown, listItemsAsMarkdown, readList, readString, stripHtml } from "./html-text.js";

/** Blocks with nothing to say in a text version of the page. */
const SKIPPED_BLOCKS = new Set(["core/html", "core/spacer", "core/icon", "core/header", "core/popup", "core/form", "core/template-part", "core/search", "core/video", "core/audio"]);
const RULE_BLOCKS = new Set(["core/separator", "core/divider"]);
/** Containers whose children each have a title worth printing above their content. */
const TITLED_CHILDREN = new Set(["core/accordion-item", "core/tab", "core/step"]);

const fenceAround = ({ code, language, title }: { code: string; language: string; title: string }): string => {
	const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(Math.max(3, longestRun + 1));
	const info = [language, title ? `title="${title.replace(/"/g, "'")}"` : ""].filter(Boolean).join(" ");
	return `${fence}${info}\n${code.replace(/\n+$/, "")}\n${fence}`;
};

const tableAsMarkdown = (data: BlockData): string => {
	const cells = (rows: BlockData[]): string[][] =>
		rows.map((row) => readList(row.cells).map((cell) => stripHtml(readString(cell.content)).replace(/\|/g, "\\|")));
	const head = cells(readList(data.head));
	const body = [...cells(readList(data.body)), ...cells(readList(data.foot))];
	const header = head[0] ?? body.shift();
	if (!header) return "";
	const line = (row: string[]): string => `| ${header.map((_, index) => row[index] ?? "").join(" | ")} |`;
	return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...[...head.slice(1), ...body].map(line)].join("\n");
};

const quoteAsMarkdown = (data: BlockData): string => {
	const lines = inlineMarkdown(readString(data.value)).split("\n");
	const citation = stripHtml(readString(data.citation));
	return [...lines, ...(citation ? [`— ${citation}`] : [])].map((line) => `> ${line}`).join("\n");
};

const buttonAsMarkdown = (data: BlockData): string => {
	const label = stripHtml(readString(data.value));
	const url = readString(data.url).trim();
	if (!label) return "";
	return url && url !== "#" ? `[${label}](${url})` : label;
};

const imageAsMarkdown = (data: BlockData): string => {
	const url = readString(data.url);
	if (!url) return "";
	const caption = stripHtml(readString(data.caption));
	const image = `![${stripHtml(readString(data.alt))}](${url})`;
	return caption ? `${image}\n\n*${caption}*` : image;
};

const listAsMarkdown = (data: BlockData): string =>
	listItemsAsMarkdown(readString(data.values))
		.map((item, index) => `${data.ordered === true ? `${index + 1}.` : "-"} ${item.replace(/\n/g, " ")}`)
		.join("\n");

/** A block's own text, for kinds this converter has no special form for. */
const plainFallback = (data: BlockData): string =>
	[readString(data.value), readString(data.content), readString(data.text)]
		.map(inlineMarkdown)
		.filter(Boolean)
		.join("\n\n");

const headingAsMarkdown = (block: BlockConfig): string => {
	const heading = collectHeadingsFromBlocks([{ ...block, children: [] }])[0];
	return heading ? `${"#".repeat(heading.level)} ${heading.text}` : "";
};

const ownMarkdown = ({ block, data }: { block: BlockConfig; data: BlockData }): string => {
	const handlers: Record<string, () => string> = {
		"core/heading": () => headingAsMarkdown(block),
		"post/title": () => headingAsMarkdown(block),
		"core/paragraph": () => inlineMarkdown(readString(data.value)),
		"core/list": () => listAsMarkdown(data),
		"core/quote": () => quoteAsMarkdown(data),
		"core/pullquote": () => quoteAsMarkdown(data),
		"core/button": () => buttonAsMarkdown(data),
		"core/image": () => imageAsMarkdown(data),
		"core/table": () => tableAsMarkdown(data),
		"core/markdown": () => (readString(data.content) || readString(data.value)).trim(),
		"core/code": () => fenceAround({ code: readString(data.content), language: readString(data.language), title: readString(data.title) }),
		"core/preformatted": () => fenceAround({ code: readString(data.content), language: "", title: "" }),
	};
	return (handlers[block.name] ?? (() => plainFallback(data)))();
};

const render = ({ blocks }: { blocks: BlockConfig[] }): string[] =>
	blocks.flatMap((block, index) => {
		if (SKIPPED_BLOCKS.has(block.name)) return [];
		if (RULE_BLOCKS.has(block.name)) return ["---"];
		const data = readBlockContentData(block.content) as BlockData;
		const title = TITLED_CHILDREN.has(block.name) ? stripHtml(readString(data.title)) : "";
		const label = title && block.name === "core/step" ? `**${index + 1}. ${title}**` : title ? `**${title}**` : "";
		const own = TITLED_CHILDREN.has(block.name) ? "" : ownMarkdown({ block, data });
		return [label, own, ...render({ blocks: block.children ?? [] })].filter(Boolean);
	});

/**
 * A page as readable markdown, for agents (`/<page>.md`) and "Copy page": headings, text, lists,
 * code fences with their language, tables, images and links stay as markdown. Blocks it has no
 * special form for fall back to their text. Layout and styling are dropped on purpose.
 */
export const blocksToMarkdown = (blocks: BlockConfig[]): string => `${render({ blocks }).join("\n\n")}\n`.replace(/^\n$/, "");
