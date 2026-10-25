import type { BlockConfig } from "../schema-types.js";
import type { MdxNode } from "../markdown/mdx-tree.js";
import { safeHref } from "../markdown/safe-href.js";
import { DOCS_HEADING_BLOCK_NAME, readDocsHeadingLevel } from "../blocks/docs-heading-model.js";
import { DOCS_LIST_BLOCK_NAME } from "../blocks/docs-list-model.js";
import { DOCS_TEXT_BLOCK_NAME } from "../blocks/docs-text-model.js";
import { buildBlock } from "./build-block.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import { readListNode } from "./docs-list-mdx.js";
import { mapCodeNode } from "./map-code.js";
import { mapTable } from "./map-table.js";
import type { MapContext } from "./map-types.js";
import { isPlainInline, sourceOf } from "./source-slice.js";

type ElementMapper = (args: { ctx: MapContext; node: MdxNode }) => BlockConfig | null;

/** Section titles a docs page takes: `## `, `### ` and `#### `. A level 1 title is the page's own, and 5 and 6 are too small to keep. */
const HEADING_DEPTHS: readonly number[] = [2, 3, 4];

const isBlank = (node: MdxNode): boolean => node.type === "text" && (node.value ?? "").trim() === "";

const mapHeading: ElementMapper = ({ ctx, node }) => {
	if (!HEADING_DEPTHS.includes(node.depth ?? 0) || !isPlainInline(node)) return null;
	return buildBlock({
		name: DOCS_HEADING_BLOCK_NAME,
		newId: ctx.newId,
		fields: { level: readDocsHeadingLevel(node.depth), text: sourceOf({ node, source: ctx.source, fromChildren: true }), anchor: "" },
	});
};

/** The one image a paragraph holds, when it holds nothing else: an image on its own line. */
const lonelyImage = (node: MdxNode): MdxNode | null => {
	const parts = (node.children ?? []).filter((child) => !isBlank(child));
	return parts.length === 1 && parts[0].type === "image" ? parts[0] : null;
};

/** An image as an image block. A link the page could not keep (`javascript:`) leaves the image as written. */
const mapImage = ({ ctx, image }: { ctx: MapContext; image: MdxNode }): BlockConfig | null => {
	const url = image.url ?? "";
	if (!url || safeHref(url) !== url) return null;
	return buildBlock({ name: CORE_BLOCK_NAMES.image, newId: ctx.newId, fields: { url, alt: image.alt ?? "", title: image.title ?? "" } });
};

const mapParagraph: ElementMapper = ({ ctx, node }) => {
	const image = lonelyImage(node);
	if (image) return mapImage({ ctx, image });
	if (!isPlainInline(node)) return null;
	return buildBlock({ name: DOCS_TEXT_BLOCK_NAME, newId: ctx.newId, fields: { text: sourceOf({ node, source: ctx.source, fromChildren: false }) } });
};

const mapList: ElementMapper = ({ ctx, node }) => {
	const list = readListNode({ list: node, source: ctx.source });
	return list ? buildBlock({ name: DOCS_LIST_BLOCK_NAME, newId: ctx.newId, fields: { style: list.style, items: list.items } }) : null;
};

/** A quote of one paragraph of plain words: the quote block holds it as one HTML paragraph, so no markup and no `&`, `<` or `>`. */
const mapQuote: ElementMapper = ({ ctx, node }) => {
	const parts = (node.children ?? []).filter((child) => !isBlank(child));
	const paragraph = parts.length === 1 && parts[0].type === "paragraph" ? parts[0] : null;
	const words = paragraph?.children ?? [];
	if (words.length === 0 || words.some((word) => word.type !== "text")) return null;
	const text = words.map((word) => word.value ?? "").join("");
	if (/[&<>]/.test(text)) return null;
	return buildBlock({ name: CORE_BLOCK_NAMES.quote, newId: ctx.newId, fields: { value: `<p>${text}</p>`, citation: "" } });
};

const mapRule: ElementMapper = ({ ctx }) => buildBlock({ name: CORE_BLOCK_NAMES.separator, newId: ctx.newId });

const ELEMENT_MAPPERS = new Map<string, ElementMapper>([
	["heading", mapHeading],
	["paragraph", mapParagraph],
	["list", mapList],
	["code", mapCodeNode],
	["table", mapTable],
	["blockquote", mapQuote],
	["thematicBreak", mapRule],
]);

/** The block a plain (non-component) element becomes, or null when no docs block holds it as written. */
export const mapElement = ({ ctx, node }: { ctx: MapContext; node: MdxNode }): BlockConfig | null => ELEMENT_MAPPERS.get(node.type)?.({ ctx, node }) ?? null;
