import type { MdxNode } from "../markdown/mdx-tree.js";

/** Components written inside a line of text (`Press <Kbd>K</Kbd>`). Every other component stands on its own lines. */
const INLINE_COMPONENTS: ReadonlySet<string> = new Set(["Kbd", "Badge"]);

/** Nodes that sit inside a line of text. Anything else is a block of its own. */
const PHRASING_TYPES: ReadonlySet<string> = new Set([
	"text",
	"emphasis",
	"strong",
	"delete",
	"inlineCode",
	"link",
	"linkReference",
	"image",
	"imageReference",
	"break",
	"mdxJsxTextElement",
	"mdxTextExpression",
	"footnoteReference",
]);

/** A JSX element, written on its own lines or inside a line of text. */
export const isJsxElement = (node: MdxNode): boolean => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

/** Whitespace only: the line break between two tags written on back-to-back lines. */
export const isBlankText = (node: MdxNode): boolean => node.type === "text" && (node.value ?? "").trim() === "";

/** A component that stands on its own (a `<Tab>`, a `<Callout>`), not one written inside a sentence. */
const isBoxTag = (node: MdxNode): boolean => node.type === "mdxJsxTextElement" && !INLINE_COMPONENTS.has(node.name ?? "");

const withoutBlankEnds = (nodes: MdxNode[]): MdxNode[] => {
	const start = nodes.findIndex((node) => !isBlankText(node));
	if (start === -1) return [];
	let end = nodes.length;
	while (end > start && isBlankText(nodes[end - 1])) end--;
	return nodes.slice(start, end);
};

/** A paragraph made from words that sat between blocks; its position spans them, so their text can be read back. */
const paragraphOf = (nodes: MdxNode[]): MdxNode => ({
	type: "paragraph",
	children: nodes,
	position: { start: { offset: nodes[0].position?.start.offset }, end: { offset: nodes[nodes.length - 1].position?.end.offset } },
});

/** Runs of words between blocks become paragraphs; a run of only line breaks is dropped. */
const groupWords = (nodes: MdxNode[]): MdxNode[] => {
	const out: MdxNode[] = [];
	let words: MdxNode[] = [];
	const endWords = (): void => {
		const kept = withoutBlankEnds(words);
		if (kept.length > 0) out.push(paragraphOf(kept));
		words = [];
	};
	for (const node of nodes) {
		if (PHRASING_TYPES.has(node.type)) {
			words.push(node);
			continue;
		}
		endWords();
		out.push(node);
	}
	endWords();
	return out;
};

/** A paragraph of nothing but components (tags on back-to-back lines) reads as those components. */
const expandTagParagraph = (node: MdxNode): MdxNode[] => {
	if (node.type !== "paragraph") return [node];
	const parts = withoutBlankEnds(node.children ?? []).filter((child) => !isBlankText(child));
	return parts.length > 0 && parts.every(isBoxTag) ? parts : [node];
};

/**
 * The block-level nodes of some MDX children, as a reader sees them. Words between blocks become
 * paragraphs, and tags written on back-to-back lines (which MDX reads as one line of text) become the
 * tags they are, so `<Tab>` one-liners and `<Tab>` blocks read the same. Passing its own output through
 * again changes nothing.
 */
export const flowNodes = (nodes: MdxNode[]): MdxNode[] => groupWords(nodes).flatMap(expandTagParagraph);
