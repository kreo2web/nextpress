import type { MarkdownNode } from "./parse-markdown.js";

/** Nodes whose text runs on to the next without a break. Everything else ends a line. */
const INLINE_TYPES = new Set(["text", "emphasis", "strong", "delete", "inlineCode", "link", "linkReference", "mdxJsxTextElement", "break"]);

/** The words in one node and everything inside it, as they read. */
export const nodeText = (node: MarkdownNode): string => {
	if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
	if (node.type === "image") return node.alt ?? "";
	if (node.type === "break") return " ";
	return (node.children ?? []).map(nodeText).join("");
};

/**
 * A parsed markdown tree as plain text, one block per line: for search and short summaries.
 * Code blocks keep their code (people search for function names); markup is dropped.
 */
export const markdownToPlainText = (tree: MarkdownNode): string => {
	const lines: string[] = [];
	const walk = (node: MarkdownNode): void => {
		if (node.type === "code") {
			if (node.value) lines.push(node.value);
			return;
		}
		const hasBlockChildren = (node.children ?? []).some((child) => !INLINE_TYPES.has(child.type));
		if (!hasBlockChildren && node.children?.length) {
			const text = nodeText(node).trim();
			if (text) lines.push(text);
			return;
		}
		node.children?.forEach(walk);
	};
	walk(tree);
	return lines.join("\n");
};
