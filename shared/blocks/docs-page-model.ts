import type { BlockContent } from "../schema-types.js";
import { readJsonData, type JsonValue } from "./docs-types.js";
import { readText } from "./read-structured.js";
import { readDocsBound, type DocsBound } from "./docs-layout-model.js";

export const DOCS_PAGE_BLOCK_NAME = "docs/page";

/**
 * One docs page inside the shell: which parts show around the reading column. The title and
 * description are the page's own (its title and search description), so authors never type them twice.
 */
export type DocsPageContent = {
	showTitle: boolean;
	showDescription: boolean;
	showBreadcrumbs: boolean;
	showToc: boolean;
	showPrevNext: boolean;
	copyPage: boolean;
};

export const DEFAULT_DOCS_PAGE_CONTENT: DocsPageContent = {
	showTitle: true,
	showDescription: true,
	showBreadcrumbs: true,
	showToc: true,
	showPrevNext: true,
	copyPage: true,
};

const readFlag = (value: JsonValue | undefined, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

export function readDocsPageContent(content: BlockContent | undefined): DocsPageContent {
	const data = readJsonData(content);
	return {
		showTitle: readFlag(data.showTitle, true),
		showDescription: readFlag(data.showDescription, true),
		showBreadcrumbs: readFlag(data.showBreadcrumbs, true),
		showToc: readFlag(data.showToc, true),
		showPrevNext: readFlag(data.showPrevNext, true),
		copyPage: readFlag(data.copyPage, true),
	};
}

/** What a docs page needs from outside its block: the shared page data plus the page's own title and description. */
export type DocsPageBound = { docs: DocsBound; title: string; description: string };

export const EMPTY_DOCS_PAGE_BOUND: DocsPageBound = {
	docs: { tree: [], breadcrumbs: [], prev: null, next: null, headings: [], markdownPath: "" },
	title: "",
	description: "",
};

/** The bound data on a docs page's content, or null when the page was not bound. */
export function readDocsPageBound(content: BlockContent | undefined): DocsPageBound | null {
	const docs = readDocsBound(content);
	if (!docs) return null;
	const data = readJsonData(content);
	return { docs, title: readText(data.pageTitle), description: readText(data.pageDescription) };
}
