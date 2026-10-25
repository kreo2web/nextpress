import { type MarkdownNode, parseMarkdown } from "./parse-markdown.js";
import { nodeText } from "./plain-text.js";

/** Characters that can mean markup. Text without any is already plain words, so it skips the parse. */
const MARKUP = /[*_`[\]<>\\~&]/;

/**
 * The inline parts of one line or paragraph of markdown. Anything that parses as a block instead
 * (text starting with `- ` or `# `) stays the text it was typed as.
 */
export const parseInlineMarkdown = (source: string): MarkdownNode[] => {
	if (!MARKUP.test(source)) return [{ type: "text", value: source }];
	const parsed = parseMarkdown({ text: source });
	const paragraphs = parsed.ok ? parsed.tree.children ?? [] : [];
	if (paragraphs.length !== 1 || paragraphs[0].type !== "paragraph") return [{ type: "text", value: source }];
	return paragraphs[0].children ?? [];
};

/** The words a reader sees in an inline markdown line: marks and link addresses dropped. For ids, search and plain copies. */
export const inlineMarkdownToText = (source: string): string =>
	parseInlineMarkdown(source).map(nodeText).join("").replace(/\s+/g, " ").trim();
