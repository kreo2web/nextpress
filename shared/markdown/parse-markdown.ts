import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { escapeMdxBraces } from "./mdx-text.js";
import { type DocComponentAllowlist, remarkSafeMdx } from "./safe-mdx.js";

/** A markdown syntax tree node, as far as the readers here need it. */
export type MarkdownNode = {
	type: string;
	value?: string;
	depth?: number;
	alt?: string | null;
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
