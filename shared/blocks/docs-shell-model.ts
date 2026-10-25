import type { BlockConfig, BlockContent } from "../schema-types.js";
import { isJsonObject, readJsonData, type JsonValue } from "./docs-types.js";
import { readText } from "./read-structured.js";
import type { DocsNavItem } from "./docs-layout-model.js";

export const DOCS_SHELL_BLOCK_NAME = "docs/shell";
export const MAX_DOCS_SHELL_LINKS = 6;

export type DocsShellLink = { label: string; url: string };
export type DocsShellSearch = { show: boolean; label: string; placeholder: string };
/**
 * Docs-wide switches chosen at setup. A page's own "This page shows" switches can only turn a
 * feature off for that page, never on when the docs have it off.
 */
export type DocsFeatures = { sidebar: boolean; toc: boolean; prevNext: boolean; copyPage: boolean };
/** Shown on the button in the top bar (e.g. "Get started"); empty label means no button. */
export type DocsShellButton = { label: string; url: string };

/**
 * The docs chrome shared by every page of a docs site: top bar (brand, search, links) and the
 * sidebar of pages. Set once on the docs root page; other pages keep `inherit` on and read it.
 * An empty `rootPageId` means "the top of the section this page sits in"; an empty `title` means
 * the root page's title.
 */
export type DocsShellContent = {
	inherit: boolean;
	rootPageId: string;
	title: string;
	logoUrl: string;
	/** Logo for dark pages; empty means the light logo is used on both. */
	logoDarkUrl: string;
	links: DocsShellLink[];
	button: DocsShellButton;
	search: DocsShellSearch;
	features: DocsFeatures;
};

export const DEFAULT_DOCS_FEATURES: DocsFeatures = { sidebar: true, toc: true, prevNext: true, copyPage: true };

export const DEFAULT_DOCS_SHELL_CONTENT: DocsShellContent = {
	inherit: true,
	rootPageId: "",
	title: "",
	logoUrl: "",
	logoDarkUrl: "",
	links: [],
	button: { label: "", url: "" },
	search: { show: true, label: "Search", placeholder: "Search the docs" },
	features: DEFAULT_DOCS_FEATURES,
};

const isRecord = isJsonObject;

const readLinks = (value: JsonValue | undefined): DocsShellLink[] =>
	(Array.isArray(value) ? value : [])
		.filter(isRecord)
		.map((item) => ({ label: readText(item.label).trim(), url: readText(item.url).trim() }))
		.filter((link) => link.label !== "" && link.url !== "")
		.slice(0, MAX_DOCS_SHELL_LINKS);

const readSearch = (value: JsonValue | undefined): DocsShellSearch => {
	const data = isRecord(value) ? value : {};
	const fallback = DEFAULT_DOCS_SHELL_CONTENT.search;
	return {
		show: typeof data.show === "boolean" ? data.show : fallback.show,
		label: readText(data.label, fallback.label),
		placeholder: readText(data.placeholder, fallback.placeholder),
	};
};

const readFeatures = (value: JsonValue | undefined): DocsFeatures => {
	const data = isRecord(value) ? value : {};
	const pick = (key: keyof DocsFeatures): boolean =>
		typeof data[key] === "boolean" ? (data[key] as boolean) : DEFAULT_DOCS_FEATURES[key];
	return { sidebar: pick("sidebar"), toc: pick("toc"), prevNext: pick("prevNext"), copyPage: pick("copyPage") };
};

const readButton = (value: JsonValue | undefined): DocsShellButton => {
	const data = isRecord(value) ? value : {};
	const label = readText(data.label).trim();
	const url = readText(data.url).trim();
	return label && url ? { label, url } : { label: "", url: "" };
};

/** Forgiving: anything missing or the wrong type falls back to the default, and it never throws. */
export function readDocsShellContent(content: BlockContent | undefined): DocsShellContent {
	const data = readJsonData(content);
	return {
		inherit: typeof data.inherit === "boolean" ? data.inherit : true,
		rootPageId: readText(data.rootPageId),
		title: readText(data.title),
		logoUrl: readText(data.logoUrl),
		logoDarkUrl: readText(data.logoDarkUrl),
		links: readLinks(data.links),
		button: readButton(data.button),
		search: readSearch(data.search),
		features: readFeatures(data.features),
	};
}

/** Where the settings a shell draws came from: its own panel, or the root page's shell. */
export type DocsShellSource = { kind: "own" } | { kind: "root"; pageId: string; title: string; path: string };

/**
 * Everything the shell needs from outside its own block, filled in when a page is served (or
 * previewed in the editor) and never saved. `settings` are the ones in force after inheritance.
 */
export type DocsShellBound = {
	settings: DocsShellContent;
	source: DocsShellSource;
	tree: DocsNavItem[];
	/** What the brand shows and where it links: the root page. */
	brandTitle: string;
	brandPath: string | null;
};

export const EMPTY_DOCS_SHELL_BOUND: DocsShellBound = {
	settings: DEFAULT_DOCS_SHELL_CONTENT,
	source: { kind: "own" },
	tree: [],
	brandTitle: "",
	brandPath: null,
};

const readNavTree = (value: JsonValue | undefined): DocsNavItem[] =>
	(Array.isArray(value) ? value : []).filter(isRecord).map((raw) => ({
		id: readText(raw.id),
		title: readText(raw.title, "Untitled"),
		path: typeof raw.path === "string" && raw.path ? raw.path : null,
		isCurrent: raw.isCurrent === true,
		children: readNavTree(raw.children),
	}));

const readSource = (value: JsonValue | undefined): DocsShellSource =>
	isRecord(value) && value.kind === "root"
		? { kind: "root", pageId: readText(value.pageId), title: readText(value.title, "Untitled"), path: readText(value.path) }
		: { kind: "own" };

/** The bound data on a shell's content, or null when the page was not bound (tests, unsaved pages). */
export function readDocsShellBound(content: BlockContent | undefined): DocsShellBound | null {
	const raw = readJsonData(content).docsShell;
	if (!isRecord(raw)) return null;
	return {
		settings: readDocsShellContent({ kind: "structured", data: isRecord(raw.settings) ? raw.settings : {} }),
		source: readSource(raw.source),
		tree: readNavTree(raw.tree),
		brandTitle: readText(raw.brandTitle),
		brandPath: typeof raw.brandPath === "string" && raw.brandPath ? raw.brandPath : null,
	};
}

/** The first docs shell anywhere in a block tree (the root page's, when asked for inheritance). */
export function findDocsShell(blocks: BlockConfig[]): BlockConfig | null {
	for (const block of blocks) {
		if (block.name === DOCS_SHELL_BLOCK_NAME) return block;
		const inner = Array.isArray(block.children) ? findDocsShell(block.children) : null;
		if (inner) return inner;
	}
	return null;
}

/**
 * The settings in force for a shell. With `inherit` on and a shell on the root page, those are
 * the root page's; a root shell that itself inherits (or a missing one) falls back to this block's own.
 */
export function resolveDocsShellSettings({ own, rootShell }: { own: DocsShellContent; rootShell: DocsShellContent | null }): DocsShellContent {
	if (!own.inherit || !rootShell) return own;
	return { ...rootShell, inherit: true };
}

/** True for a docs shell whose top bar has the search button, so the page must load the search script. */
export function blockShowsDocsSearch(block: BlockConfig): boolean {
	if (block.name !== DOCS_SHELL_BLOCK_NAME) return false;
	const settings = readDocsShellBound(block.content)?.settings ?? readDocsShellContent(block.content);
	return settings.search.show;
}
