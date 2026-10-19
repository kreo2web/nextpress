import { sanitizeHtmlBlockContent } from "../sanitize/apply-block-overrides.js";
import { sanitizeHtml } from "../sanitize/sanitize-html.js";
import type { BlockName } from "./shared-catalog.js";

type Semantic = Record<string, unknown>;

/**
 * Friendly builder key to the field the editor saves under. The builders keep their simple
 * parameter names (`code({ value })`, `quote({ text })`); the editor stores the same thing under
 * a different name, and a block saved under the wrong name shows its sample text instead.
 */
const RENAMED_KEYS: Partial<Record<BlockName, Record<string, string>>> = {
	"core/markdown": { value: "content" },
	"core/code": { value: "content" },
	"core/preformatted": { text: "content" },
	"core/quote": { text: "value" },
	"core/pullquote": { text: "value" },
	"core/media-text": { text: "content" },
	"core/file": { url: "href", filename: "fileName" },
	"core/separator": { style: "lineStyle" },
};

const renameKeys = ({
	semantic,
	renames,
}: {
	semantic: Semantic;
	renames: Record<string, string>;
}): Semantic =>
	Object.fromEntries(
		Object.entries(semantic).map(([key, value]) => {
			const renamed = Object.hasOwn(renames, key) ? renames[key] : undefined;
			// A caller who already used the saved name keeps it.
			return renamed && !(renamed in semantic) ? [renamed, value] : [key, value];
		}),
	);

const asStrings = (value: Semantic[string]): string[] | null =>
	Array.isArray(value) ? value.map((entry) => String(entry ?? "")) : null;

/** The editor stores a list as one HTML string of `<li>` items. */
const listToSaved = (semantic: Semantic): Semantic => {
	const { items, ...rest } = semantic;
	const texts = asStrings(items);
	if (!texts) return semantic;
	return { ...rest, values: texts.map((text) => `<li>${sanitizeHtml(text)}</li>`).join("") };
};

const tableRow = ({ tag, cells }: { tag: "th" | "td"; cells: string[] }) => ({
	cells: cells.map((content) => ({ content, tag })),
});

/** The editor stores a table as header, body and footer rows of cells, not plain arrays. */
const tableToSaved = (semantic: Semantic): Semantic => {
	const { headers, rows, ...rest } = semantic;
	const headerTexts = asStrings(headers);
	const rowTexts = Array.isArray(rows) ? rows.map(asStrings).filter((row) => row !== null) : null;
	return {
		...rest,
		...(headerTexts
			? { head: headerTexts.length ? [tableRow({ tag: "th", cells: headerTexts })] : [] }
			: {}),
		...(rowTexts ? { body: rowTexts.map((cells) => tableRow({ tag: "td", cells })) } : {}),
	};
};

/** The editor keeps raw HTML in `content`; the builder's `sanitized` switch only decides what is stored. */
const htmlToSaved = (semantic: Semantic): Semantic => {
	const { value, sanitized, ...rest } = semantic;
	if (typeof value !== "string") return rest;
	return { ...rest, content: sanitizeHtmlBlockContent(value, sanitized !== false) };
};

const CONVERTERS: Partial<Record<BlockName, (semantic: Semantic) => Semantic>> = {
	"core/list": listToSaved,
	"core/table": tableToSaved,
	"core/html": htmlToSaved,
};

/**
 * Turns what a builder was given into the field names and shapes the editor saves for that block,
 * so the result can be laid over the block's defaults and still be read by the editor.
 */
export const toSavedContent = ({
	name,
	semantic,
}: {
	name: BlockName;
	semantic: Semantic | undefined;
}): Semantic | undefined => {
	if (!semantic) return semantic;
	const renames = RENAMED_KEYS[name];
	const renamed = renames ? renameKeys({ semantic, renames }) : semantic;
	const convert = CONVERTERS[name];
	return convert ? convert(renamed) : renamed;
};
