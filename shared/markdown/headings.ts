import type { MarkdownNode } from "./parse-markdown.js";
import { nodeText } from "./plain-text.js";

export type MarkdownHeading = { depth: number; text: string; id: string };

export type Slugger = (text: string) => string;

/** A heading's text as a link anchor: lower case, words joined by `-`, punctuation dropped. */
export const slugifyHeading = (text: string): string =>
	text
		.trim()
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
		.replace(/\s+/g, "-") || "section";

/**
 * Anchors for one page, in reading order: the second "Install" becomes `install-1`. The renderer
 * and the heading reader each make one per page, so the table of contents and the page agree.
 */
export const createSlugger = (): Slugger => {
	const seen = new Map<string, number>();
	return (text) => {
		const base = slugifyHeading(text);
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	};
};

/** Every heading in a parsed markdown tree, in order, with the anchor the page gives it. */
export const readMarkdownHeadings = (tree: MarkdownNode, slugger: Slugger = createSlugger()): MarkdownHeading[] => {
	const headings: MarkdownHeading[] = [];
	const walk = (node: MarkdownNode): void => {
		if (node.type === "heading" && typeof node.depth === "number") {
			const text = nodeText(node);
			headings.push({ depth: node.depth, text, id: slugger(text) });
			return;
		}
		node.children?.forEach(walk);
	};
	walk(tree);
	return headings;
};
