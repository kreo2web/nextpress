import { slugifyHeading } from "../markdown/headings.js";
import { inlineMarkdownToText } from "../markdown/inline-text.js";

/**
 * The anchor a docs heading gets: the words it shows, run through `slugifyHeading`, the same
 * function the markdown contents list uses, so "On this page" links land on a heading block just
 * as they do on a heading written in markdown.
 */
export const docsHeadingId = (text: string): string => slugifyHeading(inlineMarkdownToText(text));

/** The id a heading block shows: the author's own link id (made safe) when set, else the one from its words. */
export const docsHeadingAnchor = ({ text, anchor = "" }: { text: string; anchor?: string }): string =>
	anchor.trim() ? slugifyHeading(anchor) : docsHeadingId(text);
