import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { escapeMdxBraces } from "./mdx-text.js";
import type { MdxNode } from "./mdx-tree.js";
import { type DocComponentAllowlist, remarkSafeMdx } from "./safe-mdx.js";

/** A markdown syntax tree node, as far as the readers here need it. */
export type MarkdownNode = {
	type: string;
	value?: string;
	depth?: number;
	alt?: string | null;
	/** A link's address. */
	url?: string;
	/** Task-list items: true or false when the item has a checkbox. */
	checked?: boolean | null;
	/** Lists: numbered or not, and the first number. */
	ordered?: boolean | null;
	start?: number | null;
	/** Where the node sits in the source text. */
	position?: { start: { offset?: number }; end: { offset?: number } };
	children?: MarkdownNode[];
};

export type ParsedMarkdown = { ok: true; tree: MarkdownNode } | { ok: false; message: string; line: number | null };

type ParseFailure = { reason?: string; message?: string; line?: number | null; place?: { line?: number } | null };

/** Where the problem is. Some parse errors (an unclosed tag at the end) only say it inside the reason: "(3:1-3:10)". */
const readLine = (error: ParseFailure): number | null => {
	if (typeof error.line === "number") return error.line;
	if (typeof error.place?.line === "number") return error.place.line;
	const fromReason = /\((\d+):\d+/.exec(error.reason ?? "");
	return fromReason ? Number(fromReason[1]) : null;
};

const describeFailure = (error: ParseFailure): { message: string; line: number | null } => ({
	message: (error.reason ?? error.message ?? "This markdown couldn't be read.").replace(/\s*\(\d+:\d+(?:-\d+:\d+)?\)$/, ""),
	line: readLine(error),
});

/**
 * Parses markdown, or MDX when `mdx` is on, into a syntax tree with the same rules the page renders
 * with (GitHub tables and task lists; for MDX, only allowed components, braces as text, nothing run). Never throws:
 * MDX that doesn't parse (an unclosed `<Callout>`) comes back with the reason and line, so the editor
 * can say so and the page can fall back to plain markdown.
 */
export const parseMarkdown = ({
	text,
	mdx = false,
	components = {},
}: {
	text: string;
	mdx?: boolean;
	components?: DocComponentAllowlist;
}): ParsedMarkdown => {
	const processor = mdx
		? unified().use(remarkParse).use(remarkGfm).use(remarkMdx).use(remarkSafeMdx, { components })
		: unified().use(remarkParse).use(remarkGfm);
	try {
		const tree = processor.runSync(processor.parse(mdx ? escapeMdxBraces(text) : text)) as MarkdownNode;
		return { ok: true, tree };
	} catch (error) {
		return { ok: false, ...describeFailure(error as ParseFailure) };
	}
};

/** MDX as written (`parseMdxAsWritten`): the tree, and the text its positions point into. */
export type ParsedMdxTree = { ok: true; tree: MdxNode; source: string } | { ok: false; message: string; line: number | null };

/**
 * MDX as written, with every element kept: no allowlist, so no tag is unwrapped. The docs converter
 * decides what each element becomes, and keeps whatever it can't hold word for word from `source`.
 * Braces are escaped the same way `parseMarkdown` escapes them. Never throws.
 */
export const parseMdxAsWritten = ({ text }: { text: string }): ParsedMdxTree => {
	const source = escapeMdxBraces(text);
	const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
	try {
		return { ok: true, tree: processor.runSync(processor.parse(source)) as MdxNode, source };
	} catch (error) {
		return { ok: false, ...describeFailure(error as ParseFailure) };
	}
};
