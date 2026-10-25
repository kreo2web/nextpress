import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const DOCS_LIST_BLOCK_NAME = "docs/list";

export const DOCS_LIST_STYLES = ["bullet", "number", "check"] as const;
export type DocsListStyle = (typeof DOCS_LIST_STYLES)[number];

/** `text` is inline markdown; `checked` only matters in a checklist; `children` is the one nested level. */
export type DocsListSubItem = { text: string; checked: boolean };
export type DocsListItem = DocsListSubItem & { children: DocsListSubItem[] };

/** Bullets, numbers or a checklist, with one level of nesting: `- item`, `1. item` or `- [ ] item` in MDX. */
export type DocsListContent = { style: DocsListStyle; items: DocsListItem[] };

export const DEFAULT_DOCS_LIST_CONTENT: DocsListContent = {
	style: "bullet",
	items: [
		{ text: "First point", checked: false, children: [] },
		{ text: "Second point", checked: false, children: [{ text: "A detail under it", checked: false }] },
		{ text: "Third point", checked: false, children: [] },
	],
};

/** An item as saved, before it is checked: any field may be missing or the wrong type. */
type RawItem = { text?: string; checked?: boolean; children?: RawItem[] };

const readSubItem = (value: RawItem | null | undefined): DocsListSubItem | null => {
	if (!value || typeof value !== "object") return null;
	return { text: readText(value.text), checked: value.checked === true };
};

const readItem = (value: RawItem | null | undefined): DocsListItem | null => {
	const item = readSubItem(value);
	if (!item) return null;
	const children = value?.children;
	return { ...item, children: Array.isArray(children) ? children.map(readSubItem).filter((child): child is DocsListSubItem => child !== null) : [] };
};

export function readDocsListContent(content: BlockContent | undefined): DocsListContent {
	const data = readStructuredData(content);
	const items = Array.isArray(data.items) ? data.items.map(readItem).filter((item): item is DocsListItem => item !== null) : DEFAULT_DOCS_LIST_CONTENT.items;
	return { style: readChoice({ value: data.style, options: DOCS_LIST_STYLES, fallback: "bullet" }), items };
}

/** Items a reader sees: empty rows left out (the editor keeps half-typed ones). */
export const shownListItems = (items: DocsListItem[]): DocsListItem[] =>
	items
		.filter((item) => item.text.trim() !== "")
		.map((item) => ({ ...item, children: item.children.filter((child) => child.text.trim() !== "") }));

const CHECK_PREFIX = /^\[( |x|X)\](\s+|$)/;

/**
 * The list as one line per item for the editor: two spaces start a nested item, `[ ]` or `[x]`
 * starts a checklist item. The reverse of `listFromLines`.
 */
export const listToLines = ({ style, items }: DocsListContent): string =>
	items
		.flatMap((item) => [{ ...item, depth: 0 }, ...item.children.map((child) => ({ ...child, depth: 1 }))])
		.map((row) => `${"  ".repeat(row.depth)}${style === "check" ? `[${row.checked ? "x" : " "}] ` : ""}${row.text}`)
		.join("\n");

/** One line per item back into items. A line indented under another becomes its nested item; deeper levels join level two. */
export const listFromLines = ({ style, lines }: { style: DocsListStyle; lines: string }): DocsListItem[] => {
	const items: DocsListItem[] = [];
	lines.split("\n").forEach((line) => {
		const indented = /^\s+/.test(line);
		const body = line.trim();
		const checked = style === "check" && /^\[[xX]\]/.test(body);
		const text = style === "check" ? body.replace(CHECK_PREFIX, "") : body;
		const last = items[items.length - 1];
		if (indented && last) last.children.push({ text, checked });
		else items.push({ text, checked, children: [] });
	});
	return items;
};
