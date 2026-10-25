import type { BlockConfig } from "../schema-types.js";

/** What a block writer is given: the way to write the blocks inside it, and the list of names it could not write. */
export type MdxWriteContext = {
	skipped: string[];
	writeChildren: (blocks: BlockConfig[]) => string;
};

/** One block as MDX. An empty string writes nothing. */
export type BlockWriter = (args: { block: BlockConfig; ctx: MdxWriteContext }) => string;

/** Markdown characters that would change the words if they were written bare. */
const MARKDOWN_SPECIAL = /[\\`*_[\]<>#|~]/g;

/** A line of text with its line breaks turned into spaces. */
export const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, " ").trim();

/** Text inside a list item, quote or table cell: one line, with markdown's own characters escaped so they read back as typed. */
export const escapeText = (text: string): string => oneLine(text).replace(MARKDOWN_SPECIAL, "\\$&");

/**
 * A file tree line as a list item. Only what would start markdown is escaped: a lone `*` (the highlight mark,
 * with spaces around it) and a `#` note stay as typed, since inside an item they are plain text. Underscores
 * are escaped only at the start of a word, the one place they can open emphasis.
 */
export const escapeTreeLine = (text: string): string => {
	const line = oneLine(text);
	const lone = (index: number): boolean => /\s/.test(line[index - 1] ?? " ") && /\s/.test(line[index + 1] ?? " ");
	return line
		.replace(/[\\`[\]<>~|]/g, "\\$&")
		.replace(/\*/g, (star, index: number) => (lone(index) ? star : "\\*"))
		.replace(/(^|\s)_/g, "$1\\_")
		.replace(/^#/, "\\#");
};

/** An attribute value as MDX reads it back: `&` and `"` written as character references, line breaks as spaces. */
const attrText = (value: string): string => oneLine(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** ` name="value"` for a prop, or nothing when the value is empty (so the prop is left out). */
export const attr = (name: string, value: string): string => (value === "" ? "" : ` ${name}="${attrText(value)}"`);

/** A component around its child blocks: the open and close tags on their own lines, the children separated by blank lines. */
export const wrapBlocks = ({ open, close, inner }: { open: string; close: string; inner: string }): string =>
	inner ? `${open}\n\n${inner}\n\n${close}` : `${open}\n${close}`;

/** A fenced code block with a fence longer than any run of backticks in the code, so the code can't end it early. */
export const fenced = ({ info, code }: { info: string; code: string }): string => {
	const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
	const marker = "`".repeat(Math.max(3, longest + 1));
	return `${marker}${info}\n${code.replace(/\n+$/, "")}\n${marker}`;
};

/**
 * A `title=` word on a fence's info line. Double quotes, or single quotes when the title has double ones (the
 * fence reader takes both back). A title with both kinds of quote keeps its words, with the double quotes
 * written as single ones.
 */
export const fenceTitle = (title: string): string => {
	const clean = oneLine(title);
	if (!clean.includes('"')) return `title="${clean}"`;
	if (!clean.includes("'")) return `title='${clean}'`;
	return `title="${clean.replace(/"/g, "'")}"`;
};
