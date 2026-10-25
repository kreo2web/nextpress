import type { AsPlainObject } from "minisearch";

/** Bumped when the shape of the saved search index changes, so a copy a browser already holds can be told apart. */
export const SEARCH_INDEX_VERSION = 1;

/** One searchable stretch of a page: its opening, or the words under one heading. */
export type SearchDocument = {
	id: string;
	/** The page's title. Only a page's opening entry has one, so a title match counts for the page, not for every section. */
	title: string;
	/** The heading the words sit under. Empty for a page's opening entry. */
	heading: string;
	/** Every word of the stretch. It is searched but never sent to the browser. */
	text: string;
	pageTitle: string;
	/** Where a result opens: `/guides/install`, or `/guides/install#backups` for a section. */
	path: string;
	/** The first ~240 characters of the words, cut at a word boundary. The only text the browser gets to show. */
	excerpt: string;
};

/** The settings MiniSearch needs to read the index back and to search it. Plain data only, so they can travel as JSON. */
export type SearchIndexOptions = {
	idField: string;
	fields: string[];
	storeFields: string[];
	searchOptions: {
		prefix: boolean;
		fuzzy: number;
		boost: Record<string, number>;
		combineWith: "AND" | "OR";
	};
};

/**
 * The one place the search settings are written. The server builds the index with them and sends
 * them along with it, and the browser loads and searches with what it receives, so the two sides
 * cannot drift apart. Title matches count most, then headings; every typed word must match
 * (`AND`), a word may be unfinished (`prefix`) or a little misspelled (`fuzzy`).
 */
export const SEARCH_INDEX_OPTIONS: SearchIndexOptions = {
	idField: "id",
	fields: ["title", "heading", "text"],
	storeFields: ["pageTitle", "heading", "path", "excerpt"],
	searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3, heading: 2 }, combineWith: "AND" },
};

/** What `GET /api/public/docs-index` sends. */
export type SearchIndexPayload = {
	version: typeof SEARCH_INDEX_VERSION;
	/** When the server made this index (ISO time). */
	builtAt: string;
	options: SearchIndexOptions;
	/** MiniSearch's own saved form; load it with `options`. */
	index: AsPlainObject;
};
