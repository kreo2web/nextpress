import type { MarkdownNode } from "../markdown/parse-markdown.js";

/** Inline parts the docs text block keeps: bold, italic, strike, code, links and line breaks. */
const PLAIN_INLINE = new Set(["text", "strong", "emphasis", "delete", "inlineCode", "link", "break"]);

/** True when a paragraph or heading holds only those, so the block can hold it word for word. */
export const isPlainInline = (node: MarkdownNode): boolean => (node.children ?? []).every((child) => PLAIN_INLINE.has(child.type) && isPlainInline(child));

/** True for one phrase (a run of words, emphasis, a link) that the docs text block holds as written. */
export const isPlainPhrase = (node: MarkdownNode): boolean => PLAIN_INLINE.has(node.type) && isPlainInline(node);

/**
 * The text a node was written as. `fromChildren` skips what comes before the first child and
 * after the last, so a heading gives its words without the `##`.
 */
export const sourceOf = ({ node, source, fromChildren }: { node: MarkdownNode; source: string; fromChildren: boolean }): string => {
	const first = fromChildren ? node.children?.[0] : node;
	const last = fromChildren ? node.children?.[node.children.length - 1] : node;
	const start = first?.position?.start.offset;
	const end = last?.position?.end.offset;
	return typeof start === "number" && typeof end === "number" ? source.slice(start, end) : "";
};
