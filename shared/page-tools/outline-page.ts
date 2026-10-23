import { findBlockEntry } from "../block-catalog/entries.js";
import type { BlockConfig } from "../schema-types.js";
import { isRecord, readContentRecord } from "./is-record.js";
import { countBlocks } from "./tree-find.js";

const DEFAULT_MAX_TEXT = 60;
const FOCUS_MARK = " ← selected";

/** One thing worth showing from a structured block's fields. A dotted `key` reaches into objects. */
type OutlineField = { key: string; as?: string; quoted?: boolean; count?: boolean };

const TEXT_FIELD: OutlineField = { key: "content", as: "text", quoted: true };
const VALUE_FIELD: OutlineField = { key: "value", as: "text", quoted: true };
const FORM_FIELD_FIELDS: readonly OutlineField[] = [{ key: "name" }, { key: "label", quoted: true }];

/** What each block shows in the outline besides its name and id. Blocks not listed show nothing extra. */
const STRUCTURED_FIELDS: Record<string, readonly OutlineField[]> = {
	"core/stack": [{ key: "stackType", as: "stack" }],
	"core/header": [{ key: "variant" }],
	"core/popup": [{ key: "slug" }],
	"core/form": [{ key: "name" }],
	"core/input": FORM_FIELD_FIELDS,
	"core/textarea": FORM_FIELD_FIELDS,
	"core/select": FORM_FIELD_FIELDS,
	"core/accordion-item": [{ key: "title", quoted: true }],
	"core/buttons": [{ key: "buttons", count: true }],
	"core/gallery": [{ key: "images", count: true }],
	"core/quote": [VALUE_FIELD],
	"core/pullquote": [VALUE_FIELD],
	"core/list": [{ key: "values", as: "text", quoted: true }],
	"core/code": [TEXT_FIELD],
	"core/html": [TEXT_FIELD],
	"core/markdown": [TEXT_FIELD],
	"core/preformatted": [TEXT_FIELD],
	"core/media-text": [{ key: "mediaUrl", as: "url" }],
	"core/cover": [{ key: "url" }],
	"core/file": [{ key: "fileName", quoted: true }, { key: "href", as: "url" }],
	"core/icon": [{ key: "icon.iconName", as: "icon" }],
	"core/template-part": [{ key: "templateId", as: "template" }],
	"core/grid": [{ key: "columns" }],
	"core/card": [{ key: "look" }, { key: "link", as: "url" }],
	"core/badge": [{ key: "text", quoted: true }],
	"core/search": [{ key: "label", quoted: true }],
	"core/docs-layout": [{ key: "rootPageId" }],
	"core/steps": [{ key: "layout" }],
	"core/step": [{ key: "title", quoted: true }],
	"core/tab": [{ key: "title", quoted: true }],
	"core/logo-cloud": [{ key: "logos", count: true }],
	"post/title": [{ key: "text", quoted: true }],
	"post/excerpt": [{ key: "text", quoted: true }],
	"post/featured-image": [{ key: "url" }],
};

/** Plain text of a value that may hold inline HTML: tags dropped, spaces collapsed. */
const toPlainText = (value: string): string =>
	value
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();

const shorten = ({ text, max }: { text: string; max: number }): string =>
	text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

const readPath = ({ source, path }: { source: Record<string, unknown>; path: string }): unknown =>
	path.split(".").reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), source);

const formatField = ({ field, value, max }: { field: OutlineField; value: unknown; max: number }): string | null => {
	const name = field.as ?? field.key.split(".").pop() ?? field.key;
	if (field.count) return Array.isArray(value) && value.length > 0 ? `${name}=${value.length}` : null;
	if (typeof value === "number" || typeof value === "boolean") return `${name}=${value}`;
	if (typeof value !== "string") return null;
	const text = toPlainText(value);
	if (!text) return null;
	if (field.quoted || /\s/.test(text)) return `${name}=${JSON.stringify(shorten({ text, max }))}`;
	return `${name}=${shorten({ text, max })}`;
};

const readStructuredTokens = ({ block, max }: { block: BlockConfig; max: number }): string[] => {
	const fields = readContentRecord(block.content);
	const data = fields && isRecord(fields.data) ? fields.data : null;
	if (!data) return [];
	return (STRUCTURED_FIELDS[block.name] ?? []).flatMap((field) => {
		const token = formatField({ field, value: readPath({ source: data, path: field.key }), max });
		return token ? [token] : [];
	});
};

/** Text blocks show level, words and link; media blocks show the file and its alt text. */
const readKindedTokens = ({ content, max }: { content: Record<string, unknown>; max: number }): string[] => {
	const fields: readonly OutlineField[] =
		content.kind === "media"
			? [{ key: "url" }, { key: "alt", quoted: true }]
			: [{ key: "level" }, { key: "value", as: "text", quoted: true }, { key: "url" }];
	return fields.flatMap((field) => {
		const token = formatField({ field, value: content[field.key], max });
		return token ? [token] : [];
	});
};

const readContentTokens = ({ block, max }: { block: BlockConfig; max: number }): string[] => {
	const content = readContentRecord(block.content);
	if (!content) return [];
	if (content.kind === "structured") return readStructuredTokens({ block, max });
	if (content.kind === "text" || content.kind === "media") return readKindedTokens({ content, max });
	if (content.kind === "markdown" || content.kind === "html") {
		const token = formatField({ field: VALUE_FIELD, value: content.value, max });
		return token ? [token] : [];
	}
	return [];
};

const readLabelToken = ({ block, max }: { block: BlockConfig; max: number }): string | null => {
	const label = block.label?.trim();
	if (!label || label === findBlockEntry(block.name)?.label) return null;
	return `label=${JSON.stringify(shorten({ text: label, max }))}`;
};

const countInside = (block: BlockConfig): number => (block.children ? countBlocks(block.children) : 0);

export type OutlinePageParams = {
	blocks: BlockConfig[];
	/** The selected block; its line is marked "← selected". */
	focusBlockId?: string | null;
	/** Longest text, label or url shown per line. Default 60 characters. */
	maxText?: number;
	/** Hides blocks deeper than this (root blocks are depth 0) and says how many hide inside each cut block. */
	maxDepth?: number;
};

/**
 * A short indented text outline of a page, for a model (or a person) to read: one line per
 * block with its short name (no `core/`), its id, a custom label when it differs from the
 * catalog's, and the few facts that identify it (the first words of text, heading level,
 * link, picture and alt text, stack type, header variant, popup slug, form field name).
 *
 * WHY: a whole block tree is tens of kilobytes of styles and settings. The outline is the
 * map an agent reads first; it then asks for a single block in full when it needs detail.
 */
export const outlinePage = ({ blocks, focusBlockId, maxText = DEFAULT_MAX_TEXT, maxDepth }: OutlinePageParams): string => {
	if (blocks.length === 0) return "(empty page)";
	const lines: string[] = [];

	const walk = (nodes: BlockConfig[], depth: number): void => {
		for (const block of nodes) {
			const hidden = maxDepth !== undefined && depth >= maxDepth ? countInside(block) : 0;
			const parts = [
				`${"  ".repeat(depth)}${block.name.replace(/^core\//, "")}`,
				`id=${block.id}`,
				...[readLabelToken({ block, max: maxText })].flatMap((token) => (token ? [token] : [])),
				...readContentTokens({ block, max: maxText }),
				...(hidden > 0 ? [`(+${hidden} inside)`] : []),
			];
			lines.push(parts.join(" ") + (block.id === focusBlockId ? FOCUS_MARK : ""));
			if (block.children?.length && hidden === 0) walk(block.children, depth + 1);
		}
	};

	walk(blocks, 0);
	return lines.join("\n");
};
