import type { DocsTree, DocsTreeItem } from "@shared/docs";

/** One place a new docs page can go: the top of the docs, or under any page or group. */
export type PutUnderOption = { value: string; label: string; depth: number };

const ROOT_LABEL = "Top level of the docs";

const labelOf = (item: DocsTreeItem): string => {
	const marks = [item.kind === "group" && "group", item.hidden && "hidden"].filter((mark): mark is string => typeof mark === "string");
	return marks.length > 0 ? `${item.title} (${marks.join(", ")})` : item.title;
};

const walk = ({ items, depth }: { items: DocsTreeItem[]; depth: number }): PutUnderOption[] =>
	items.flatMap((item) => [{ value: item.id, label: labelOf(item), depth }, ...walk({ items: item.children, depth: depth + 1 })]);

/**
 * Every place a page can go, in sidebar order. All pages of a docs sit under its home, so
 * "under the home" is the top level of the sidebar; everything else is a group or a page.
 */
export function buildPutUnderOptions({ tree }: { tree: DocsTree }): PutUnderOption[] {
	return [{ value: tree.home.id, label: ROOT_LABEL, depth: 0 }, ...walk({ items: tree.home.children, depth: 1 })];
}

/** The label with a little indent per level, so a plain select still shows what sits in what. */
export const indentOptionLabel = ({ label, depth }: PutUnderOption): string => `${"   ".repeat(Math.max(0, depth - 1))}${label}`;
