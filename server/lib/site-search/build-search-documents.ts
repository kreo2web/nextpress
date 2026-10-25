import { extractPageText, type PageSection } from "@shared/content-text";
import type { BlockConfig } from "@shared/schema-types";
import type { SearchDocument } from "./search-index-options";

/** A page visitors may read, as the index needs it. `path` is its full address without the leading slash (`guides/install`). */
export type SearchablePage = { id: string; title: string; path: string; blocks: BlockConfig[] };

const EXCERPT_LENGTH = 240;

/** The first ~240 characters on one line, cut at a word boundary so a word is never split. */
export const makeExcerpt = (text: string): string => {
	const flat = text.replace(/\s+/g, " ").trim();
	if (flat.length <= EXCERPT_LENGTH) return flat;
	const cut = flat.slice(0, EXCERPT_LENGTH);
	const endsOnBoundary = flat[EXCERPT_LENGTH] === " ";
	const lastSpace = cut.lastIndexOf(" ");
	// One very long word (a link, a hash) has no boundary to back up to; keep the plain cut.
	const kept = endsOnBoundary || lastSpace < EXCERPT_LENGTH / 2 ? cut : cut.slice(0, lastSpace);
	// Never end on half of an emoji or other two-part character.
	const whole = /[\uD800-\uDBFF]$/.test(kept) ? kept.slice(0, -1) : kept;
	return `${whole.trimEnd()}…`;
};

/** A section's words without its own heading line (the first line). */
const bodyOf = (section: PageSection | undefined): string => section?.text.split("\n").slice(1).join(" ") ?? "";

/**
 * A page as search entries: one for its opening (the page title and the words before the first
 * heading) and one per heading, so a result can open the section that has the words.
 * When a page starts straight with a heading, the opening entry shows the first section's words.
 */
export const buildSearchDocuments = (page: SearchablePage): SearchDocument[] => {
	const { sections } = extractPageText(page.blocks);
	const intro = sections.filter((section) => section.id === "" || section.heading === "");
	const headed = sections.filter((section) => section.id !== "" && section.heading !== "");
	const path = `/${page.path}`;
	const introText = intro.map((section) => section.text).join(" ");
	const base = { pageTitle: page.title, path };

	const opening: SearchDocument = {
		...base,
		id: `${page.id}:page`,
		title: page.title,
		heading: "",
		text: introText,
		excerpt: makeExcerpt(introText || bodyOf(headed[0])),
	};
	const bySection = headed.map(
		(section, index): SearchDocument => ({
			...base,
			id: `${page.id}:${index}`,
			title: "",
			heading: section.heading,
			text: section.text,
			path: `${path}#${section.id}`,
			excerpt: makeExcerpt(bodyOf(section)),
		}),
	);
	return [opening, ...bySection];
};
