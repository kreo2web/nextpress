import { createSlugger } from "./headings.js";
import type { MarkdownNode } from "./parse-markdown.js";
import { nodeText } from "./plain-text.js";

type HeadingNode = MarkdownNode & { data?: { hProperties?: Record<string, string> } };

/** The prefix the HTML sanitizer adds to ids so a page can't clash with the app's own. Removed again when rendering. */
export const SANITIZED_ID_PREFIX = "user-content-";

/**
 * A remark step that gives every heading its anchor id while parsing, with the same rules
 * `readMarkdownHeadings` uses, so "on this page" links always land. Doing it in the parse (not
 * while React renders) means a re-render can never renumber them.
 */
export const remarkHeadingIds = () => (tree: MarkdownNode): void => {
	const slugger = createSlugger();
	const walk = (node: HeadingNode): void => {
		if (node.type === "heading") {
			node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: slugger(nodeText(node)) } };
			return;
		}
		node.children?.forEach(walk);
	};
	walk(tree);
};

/** The heading id as the reader should see it in links. */
export const readHeadingId = (id: string | undefined): string | undefined =>
	id?.startsWith(SANITIZED_ID_PREFIX) ? id.slice(SANITIZED_ID_PREFIX.length) : id;
