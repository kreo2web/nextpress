import MiniSearch from "minisearch";
import { extractPageText } from "@shared/content-text";
import type { BlockConfig } from "@shared/schema-types";

/** One published page, as the index needs it. */
/** `path` is the full address without the leading slash (`guides/install`); a top-level page may leave it out. */
export type SearchablePage = { id: string; title: string; slug: string; path?: string; blocks: BlockConfig[] };

export type SearchHit = {
	title: string;
	/** Where the result opens: `/guides/install`, or with `#section` when the words were found under a heading. */
	path: string;
	snippet: string;
};

export type SearchIndex = {
	search: (params: { query: string; limit: number }) => SearchHit[];
	/** How many pages went in (tests and logs). */
	pageCount: number;
};

type IndexedPart = {
	id: string;
	pageId: string;
	title: string;
	heading: string;
	text: string;
	path: string;
	pageTitle: string;
};

const SNIPPET_LENGTH = 160;
const SEARCH_FIELDS = ["title", "heading", "text"] as const;

/** A short stretch of text around the first searched word, so a result shows why it matched. */
export const makeSnippet = ({ text, query }: { text: string; query: string }): string => {
	const flat = text.replace(/\s+/g, " ").trim();
	if (flat.length <= SNIPPET_LENGTH) return flat;
	const lower = flat.toLowerCase();
	const at = query
		.toLowerCase()
		.split(/\s+/)
		.map((word) => lower.indexOf(word))
		.filter((position) => position >= 0)
		.sort((a, b) => a - b)[0];
	const start = Math.max(0, (at ?? 0) - 40);
	const slice = flat.slice(start, start + SNIPPET_LENGTH).trim();
	return `${start > 0 ? "…" : ""}${slice}${start + SNIPPET_LENGTH < flat.length ? "…" : ""}`;
};

const partsOfPage = (page: SearchablePage): IndexedPart[] => {
	const path = `/${page.path ?? page.slug}`;
	const { sections } = extractPageText(page.blocks);
	const intro = sections.filter((section) => section.id === "" || section.heading === "");
	const headed = sections.filter((section) => section.id !== "" && section.heading !== "");
	const base = { pageId: page.id, pageTitle: page.title, path };
	return [
		{ ...base, id: `${page.id}:page`, title: page.title, heading: "", text: intro.map((section) => section.text).join(" ") },
		...headed.map((section, index) => ({
			...base,
			id: `${page.id}:${index}`,
			title: "",
			heading: section.heading,
			text: section.text,
			path: `${path}#${section.id}`,
		})),
	];
};

/**
 * A search index over a site's published pages. Each page goes in as one entry for its title and
 * opening text, plus one per heading section, so a hit can link to the section that has the words.
 * Title matches count most, then headings.
 */
export const buildSearchIndex = (pages: SearchablePage[]): SearchIndex => {
	const parts = pages.flatMap(partsOfPage);
	const byId = new Map(parts.map((part) => [part.id, part]));
	const mini = new MiniSearch<IndexedPart>({
		fields: [...SEARCH_FIELDS],
		idField: "id",
		searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3, heading: 2 } },
	});
	mini.addAll(parts);

	const search = ({ query, limit }: { query: string; limit: number }): SearchHit[] => {
		const all = mini.search(query, { combineWith: "AND" });
		const found = all.length > 0 ? all : mini.search(query, { combineWith: "OR" });
		const seen = new Set<string>();
		return found.flatMap((result) => {
			const part = byId.get(result.id);
			if (!part || seen.has(part.pageId)) return [];
			seen.add(part.pageId);
			const snippet = makeSnippet({ text: part.text || part.heading || part.pageTitle, query });
			return [{ title: part.pageTitle, path: part.path, snippet }];
		}).slice(0, limit);
	};

	return { search, pageCount: pages.length };
};
