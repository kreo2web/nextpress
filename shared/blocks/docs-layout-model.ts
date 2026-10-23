import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const DOCS_LAYOUT_BLOCK_NAME = "core/docs-layout";

/**
 * The docs layout: a sidebar of pages, the page's content in the middle, "On this page" on the
 * right. An empty `rootPageId` means "the top of the section this page sits in".
 */
export type DocsLayoutContent = {
	rootPageId: string;
	showToc: boolean;
	showPrevNext: boolean;
	showBreadcrumbs: boolean;
	copyPage: boolean;
};

export const DEFAULT_DOCS_LAYOUT_CONTENT: DocsLayoutContent = {
	rootPageId: "",
	showToc: true,
	showPrevNext: true,
	showBreadcrumbs: true,
	copyPage: true,
};

const readFlag = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

/** Forgiving: anything missing or the wrong type falls back to the default, and it never throws. */
export function readDocsLayoutContent(content: BlockContent | undefined): DocsLayoutContent {
	const data = readStructuredData(content);
	return {
		rootPageId: readText(data.rootPageId, DEFAULT_DOCS_LAYOUT_CONTENT.rootPageId),
		showToc: readFlag(data.showToc, true),
		showPrevNext: readFlag(data.showPrevNext, true),
		showBreadcrumbs: readFlag(data.showBreadcrumbs, true),
		copyPage: readFlag(data.copyPage, true),
	};
}

/** One line in the sidebar. `path` is null for a group whose own page a visitor can't open. */
export type DocsNavItem = {
	id: string;
	title: string;
	path: string | null;
	isCurrent: boolean;
	children: DocsNavItem[];
};

export type DocsCrumb = { title: string; path: string | null };
export type DocsLink = { title: string; path: string };
export type DocsHeading = { id: string; text: string; level: 2 | 3 };

/**
 * Everything the docs layout needs from outside its own block. Filled in when a page is served
 * (or previewed in the editor) and never saved, so a renamed page never leaves stale links behind.
 * Paths start with a slash.
 */
export type DocsBound = {
	tree: DocsNavItem[];
	breadcrumbs: DocsCrumb[];
	prev: DocsLink | null;
	next: DocsLink | null;
	headings: DocsHeading[];
	/** Where this page's markdown copy lives (`/guides/install.md`); empty when unknown. */
	markdownPath: string;
};

export const EMPTY_DOCS_BOUND: DocsBound = { tree: [], breadcrumbs: [], prev: null, next: null, headings: [], markdownPath: "" };

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const asList = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const readNavItem = (raw: Raw): DocsNavItem => ({
	id: readText(raw.id),
	title: readText(raw.title, "Untitled"),
	path: typeof raw.path === "string" && raw.path ? raw.path : null,
	isCurrent: raw.isCurrent === true,
	children: asList(raw.children).map(readNavItem),
});

const readLink = (raw: unknown): DocsLink | null => {
	if (!isRecord(raw) || typeof raw.path !== "string" || !raw.path) return null;
	return { title: readText(raw.title, "Untitled"), path: raw.path };
};

/** The bound data on a block's content, or null when the page was not bound (the SPA view, tests). */
export function readDocsBound(content: BlockContent | undefined): DocsBound | null {
	const raw = readStructuredData(content).docs;
	if (!isRecord(raw)) return null;
	const data = raw;
	return {
		tree: asList(data.tree).map(readNavItem),
		breadcrumbs: asList(data.breadcrumbs).map((crumb) => ({
			title: readText(crumb.title, "Untitled"),
			path: typeof crumb.path === "string" && crumb.path ? crumb.path : null,
		})),
		prev: readLink(data.prev),
		next: readLink(data.next),
		headings: asList(data.headings).flatMap((heading) =>
			typeof heading.id === "string" && heading.id && (heading.level === 2 || heading.level === 3)
				? [{ id: heading.id, text: readText(heading.text), level: heading.level as 2 | 3 }]
				: [],
		),
		markdownPath: readText(data.markdownPath),
	};
}

/** The ids that tie the Menu button to the sidebar drawer. */
export const docsElementIds = (blockId: string): { nav: string } => ({ nav: `np-docs-${blockId}-nav` });
