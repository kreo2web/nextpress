/** Text blocks that can show inline markup (`format: "html"`). Their renderer cleans it first. */
const HTML_TEXT_BLOCKS = new Set(["core/heading", "core/paragraph"]);

const INLINE_TAG = /<\/?(a|b|strong|i|em|u|s|mark|code|br|span|sub|sup|small)\b[^>]*>/i;

/**
 * Content fields with `format: "html"` added when an agent writes inline markup (bold, a link)
 * into a heading's or paragraph's text without saying so. Without it the tags show on the page
 * as text. The WordPress import marks such text the same way.
 */
export const withInlineHtmlFormat = ({
	name,
	fields,
}: {
	name: string;
	fields: Record<string, unknown> | undefined;
}): Record<string, unknown> | undefined =>
	fields && HTML_TEXT_BLOCKS.has(name) && fields.format === undefined && typeof fields.value === "string" && INLINE_TAG.test(fields.value)
		? { ...fields, format: "html" }
		: fields;
