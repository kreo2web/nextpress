/** A content value as it may arrive from a saved block. Readers below accept it and return plain strings. */
export type Loose = string | number | boolean | null | undefined | object;

/** One block's fields, as the saved content holds them. */
export type BlockData = Record<string, Loose>;

const ENTITIES: Record<string, string> = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

/** A saved field as text, or empty when it is not text. */
export const readString = (value: Loose): string => (typeof value === "string" ? value : "");

/** A saved field as a list of records (table rows, cells), or none. */
export const readList = (value: Loose): BlockData[] =>
	Array.isArray(value) ? value.filter((item): item is BlockData => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];

const decodeEntities = (text: string): string =>
	text
		.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (match) => ENTITIES[match] ?? match)
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));

const withoutScripts = (html: string): string =>
	html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ");

/** HTML as the words a reader sees: tags dropped, entities decoded, spaces collapsed. */
export const stripHtml = (html: string): string =>
	decodeEntities(withoutScripts(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The text of each `<li>` in a list's saved HTML. A list without `<li>` tags is one item. */
export const listItemsFromHtml = (html: string): string[] => {
	const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
	return (items.length > 0 ? items : [html]).map(stripHtml).filter(Boolean);
};

/** The same, keeping links, bold, italic and code as markdown. */
export const listItemsAsMarkdown = (html: string): string[] => {
	const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
	return (items.length > 0 ? items : [html]).map(inlineMarkdown).filter(Boolean);
};

/** Inline HTML as markdown: links, bold, italic, code and line breaks survive; other tags are dropped. */
export const inlineMarkdown = (html: string): string => {
	const marked = withoutScripts(html)
		.replace(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => `[${stripHtml(label)}](${href})`)
		.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner: string) => `**${stripHtml(inner)}**`)
		.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner: string) => `*${stripHtml(inner)}*`)
		.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, inner: string) => `\`${stripHtml(inner)}\``)
		.replace(/<br\s*\/?>/gi, "\n");
	return decodeEntities(marked.replace(/<(?!\/?\s*$)[^>]+>/g, " "))
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.filter(Boolean)
		.join("\n");
};
