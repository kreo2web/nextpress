import { docsHeadingAnchor, docsHeadingId } from "./blocks/docs-heading-id";
import { DOCS_HEADING_BLOCK_NAME, readDocsHeadingContent } from "./blocks/docs-heading-model";
import { readUpdateContent, UPDATE_BLOCK_NAME } from "./blocks/update-model";
import { inlineMarkdownToText } from "./markdown/inline-text";
import type { BlockConfig } from "./schema-types";
import { headingLevelFromTag, readBlockContentData } from "./read-block-content";

export type PageHeading = {
	id: string;
	text: string;
	level: number;
};

function isRecord(value: object | null): value is Record<string, string | number | boolean | null> {
	return value !== null && !Array.isArray(value);
}

/** Strip markup so a heading slug and TOC label stay readable. */
export function stripHeadingText(value: string): string {
	return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Stable URL fragment from heading words. */
export function slugFromHeadingText(text: string): string {
	return stripHeadingText(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

/** Prefer a saved anchor; otherwise slug the visible text. */
export function headingAnchorId({
	text,
	anchor,
}: {
	text: string;
	anchor?: string;
}): string {
	const fromAnchor = typeof anchor === "string" ? anchor.trim() : "";
	if (fromAnchor) return fromAnchor;
	return slugFromHeadingText(text);
}

function headingFromBlock(block: BlockConfig): PageHeading | null {
	if (block.name === UPDATE_BLOCK_NAME) {
		// A changelog entry is listed under its label, with the same id its view gives the label (`docsHeadingId`).
		const { label } = readUpdateContent(block.content);
		return label.trim() ? { id: docsHeadingId(label), text: label.trim(), level: 2 } : null;
	}
	if (block.name === DOCS_HEADING_BLOCK_NAME) {
		const { level, text, anchor } = readDocsHeadingContent(block.content);
		const plain = inlineMarkdownToText(text);
		return plain ? { id: docsHeadingAnchor({ text, anchor }), text: plain, level } : null;
	}
	const data = readBlockContentData(block.content);
	if (block.name === "core/heading") {
		const text = stripHeadingText(
			typeof data.value === "string" ? data.value : typeof data.content === "string" ? data.content : "",
		);
		if (!text) return null;
		const level = typeof data.level === "number" && data.level >= 1 && data.level <= 6 ? data.level : 2;
		const id = headingAnchorId({
			text,
			anchor: typeof data.anchor === "string" ? data.anchor : undefined,
		});
		return { id: id || "heading", text, level };
	}
	if (block.name === "post/title") {
		const text = stripHeadingText(
			typeof data.text === "string" ? data.text : typeof data.value === "string" ? data.value : "",
		);
		if (!text) return null;
		const level = headingLevelFromTag(data.tag ?? data.level, 1);
		const id = headingAnchorId({
			text,
			anchor: typeof data.anchor === "string" ? data.anchor : undefined,
		});
		return { id: id || "heading", text, level };
	}
	return null;
}

/** Headings in tree order, for a table of contents. */
export function collectHeadingsFromBlocks(blocks: BlockConfig[], maxDepth = 6): PageHeading[] {
	const entries: PageHeading[] = [];
	const walk = (nodes: BlockConfig[]) => {
		for (const node of nodes) {
			const heading = headingFromBlock(node);
			if (heading && heading.level <= maxDepth) entries.push(heading);
			if (Array.isArray(node.children) && node.children.length > 0) walk(node.children);
		}
	};
	walk(blocks);
	return entries;
}

/** Read headings already bound onto a table of contents block. */
export function readBoundHeadings(value: unknown): PageHeading[] {
	if (!Array.isArray(value)) return [];
	const entries: PageHeading[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object" || !isRecord(item)) continue;
		const text = typeof item.text === "string" ? item.text.trim() : "";
		if (!text) continue;
		const id =
			typeof item.id === "string" && item.id.trim()
				? item.id.trim()
				: slugFromHeadingText(text) || "heading";
		const level =
			typeof item.level === "number" && item.level >= 1 && item.level <= 6 ? item.level : 2;
		entries.push({ id, text, level });
	}
	return entries;
}
