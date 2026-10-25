import type { DocsListContent, DocsListItem, DocsListStyle, DocsListSubItem } from "../blocks/docs-list-model.js";
import type { MarkdownNode } from "../markdown/parse-markdown.js";
import { isPlainInline, sourceOf } from "./source-slice.js";

const lineStart = ({ style, number, checked }: { style: DocsListStyle; number: number; checked: boolean }): string => {
	const marker = style === "number" ? `${number}.` : "-";
	return `${marker} ${style === "check" ? `[${checked ? "x" : " "}] ` : ""}`;
};

const oneLine = (text: string): string => text.trim().replace(/\s*\n\s*/g, " ");

/** A list as MDX: `- item`, `1. item` or `- [ ] item`, nested items indented under their parent. */
export const docsListToMdx = ({ style, items }: DocsListContent): string =>
	items
		.filter((item) => item.text.trim() !== "")
		.flatMap((item, index) => {
			const start = lineStart({ style, number: index + 1, checked: item.checked });
			const indent = " ".repeat(style === "number" ? `${index + 1}. `.length : 2);
			const children = item.children
				.filter((child) => child.text.trim() !== "")
				.map((child, childIndex) => `${indent}${lineStart({ style, number: childIndex + 1, checked: child.checked })}${oneLine(child.text)}`);
			return [`${start}${oneLine(item.text)}`, ...children];
		})
		.join("\n");

type ListShape = { ordered: boolean; check: boolean };

/** One item's words and tick, or null when it holds anything but a single paragraph of plain inline text. */
const readItemText = ({ item, source, shape }: { item: MarkdownNode; source: string; shape: ListShape }): DocsListSubItem | null => {
	const paragraphs = (item.children ?? []).filter((child) => child.type === "paragraph");
	if (paragraphs.length > 1 || !paragraphs.every(isPlainInline)) return null;
	if (shape.check !== (typeof item.checked === "boolean")) return null;
	const text = paragraphs[0] ? sourceOf({ node: paragraphs[0], source, fromChildren: false }) : "";
	return { text: text.split("\n").map((line) => line.trim()).join("\n"), checked: item.checked === true };
};

const shapeOf = (list: MarkdownNode): ListShape | null => {
	const items = list.children ?? [];
	const check = items.some((item) => typeof item.checked === "boolean");
	const ordered = list.ordered === true;
	if (ordered && (check || (list.start ?? 1) !== 1)) return null;
	return { ordered, check };
};

const readNested = ({ item, source, shape }: { item: MarkdownNode; source: string; shape: ListShape }): DocsListSubItem[] | null => {
	const rest = (item.children ?? []).filter((child) => child.type !== "paragraph");
	if (rest.length === 0) return [];
	const nested = rest[0];
	if (rest.length > 1 || nested.type !== "list") return null;
	const nestedShape = shapeOf(nested);
	if (!nestedShape || nestedShape.ordered !== shape.ordered || nestedShape.check !== shape.check) return null;
	const children = (nested.children ?? []).map((child) => (child.children ?? []).some((part) => part.type === "list") ? null : readItemText({ item: child, source, shape }));
	return children.every((child): child is DocsListSubItem => child !== null) ? children : null;
};

/**
 * A parsed list as list content, or null when the list holds more than the block can: a mixed
 * list (some items with a box, some without), a numbered list starting past 1, an item with a
 * code block or image in it, or a third level. Those stay as markdown so nothing is lost.
 */
export const readListNode = ({ list, source }: { list: MarkdownNode; source: string }): DocsListContent | null => {
	const shape = shapeOf(list);
	if (!shape) return null;
	const items = (list.children ?? []).map((item): DocsListItem | null => {
		const own = readItemText({ item, source, shape });
		const children = readNested({ item, source, shape });
		return own && children ? { ...own, children } : null;
	});
	if (!items.every((item): item is DocsListItem => item !== null)) return null;
	return { style: shape.check ? "check" : shape.ordered ? "number" : "bullet", items };
};
