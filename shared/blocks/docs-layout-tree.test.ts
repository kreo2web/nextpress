import { describe, expect, it } from "vitest";
import { buildDocsBound, pickTocHeadings, type DocsPage } from "./docs-layout-tree.js";
import { readDocsBound, readDocsLayoutContent } from "./docs-layout-model.js";

const page = (overrides: Partial<DocsPage> & { id: string }): DocsPage => ({
	title: overrides.id,
	slug: overrides.id,
	parentId: null,
	menuOrder: 0,
	status: "publish",
	password: null,
	...overrides,
});

const docs = page({ id: "docs", title: "Docs" });
const start = page({ id: "start", title: "Getting started", parentId: "docs", menuOrder: 1 });
const install = page({ id: "install", title: "Install", parentId: "start", menuOrder: 1 });
const config = page({ id: "config", title: "Configure", parentId: "start", menuOrder: 2 });
const guides = page({ id: "guides", title: "Guides", parentId: "docs", menuOrder: 2 });
const blog = page({ id: "blog", title: "Blog" });

const titles = (items: { title: string; children: unknown[] }[]): string[] => items.map((item) => item.title);

describe("buildDocsBound tree", () => {
	const pages = [docs, guides, config, install, start, blog];

	it("starts at the top-level page and lists its pages by menu order", () => {
		const { tree } = buildDocsBound({ pages, currentPageId: "install" });
		expect(titles(tree)).toEqual(["Docs", "Getting started", "Guides"]);
		expect(tree[1].path).toBe("/docs/start");
		expect(titles(tree[1].children as typeof tree)).toEqual(["Install", "Configure"]);
		expect((tree[1].children[0] as { path: string }).path).toBe("/docs/start/install");
	});

	it("breaks a menu-order tie by title", () => {
		const a = page({ id: "a", title: "Zeta", parentId: "docs", menuOrder: 5 });
		const b = page({ id: "b", title: "Alpha", parentId: "docs", menuOrder: 5 });
		const { tree } = buildDocsBound({ pages: [docs, a, b], currentPageId: "docs" });
		expect(titles(tree)).toEqual(["Docs", "Alpha", "Zeta"]);
	});

	it("marks only the current page", () => {
		const { tree } = buildDocsBound({ pages, currentPageId: "install" });
		const flat = tree.flatMap((item) => [item, ...(item.children as typeof tree)]);
		expect(flat.filter((item) => item.isCurrent).map((item) => item.id)).toEqual(["install"]);
	});

	it("uses the chosen root page instead of the top-level page", () => {
		const { tree } = buildDocsBound({ pages, currentPageId: "install", rootPageId: "start" });
		expect(titles(tree)).toEqual(["Getting started", "Install", "Configure"]);
	});

	it("falls back to the top-level page when the chosen root does not exist", () => {
		const { tree } = buildDocsBound({ pages, currentPageId: "install", rootPageId: "gone" });
		expect(tree[0].title).toBe("Docs");
	});

	it("shows a page visitors can't open as a plain label when pages under it are open", () => {
		const hiddenStart = { ...start, status: "draft" };
		const { tree } = buildDocsBound({ pages: [docs, hiddenStart, install, config, guides], currentPageId: "guides" });
		const group = tree.find((item) => item.id === "start");
		expect(group?.path).toBeNull();
		expect(titles(group?.children as typeof tree)).toEqual(["Install", "Configure"]);
	});

	it("leaves out a draft or passworded page with nothing open below it", () => {
		const locked = { ...config, password: "pw" };
		const draft = { ...guides, status: "draft" };
		const { tree } = buildDocsBound({ pages: [docs, start, install, locked, draft], currentPageId: "docs" });
		expect(titles(tree)).toEqual(["Docs", "Getting started"]);
		expect(titles(tree[1].children as typeof tree)).toEqual(["Install"]);
	});

	it("still shows the page being edited when it is a draft", () => {
		const draft = { ...install, status: "draft" };
		const { tree } = buildDocsBound({ pages: [docs, start, draft], currentPageId: "install" });
		expect((tree[1].children[0] as { isCurrent: boolean }).isCurrent).toBe(true);
	});

	it("survives a loop in the parents", () => {
		const a = page({ id: "a", parentId: "b" });
		const b = page({ id: "b", parentId: "a" });
		expect(() => buildDocsBound({ pages: [a, b], currentPageId: "a" })).not.toThrow();
	});

	it("returns nothing but the headings for an unknown current page", () => {
		const headings = [{ id: "x", text: "X", level: 2 as const }];
		expect(buildDocsBound({ pages, currentPageId: "nope", headings })).toMatchObject({ tree: [], prev: null, next: null, headings });
	});
});

describe("buildDocsBound reading order", () => {
	const pages = [docs, start, install, config, guides];

	it("has no previous page on the first and no next page on the last", () => {
		expect(buildDocsBound({ pages, currentPageId: "docs" })).toMatchObject({ prev: null, next: { title: "Getting started", path: "/docs/start" } });
		expect(buildDocsBound({ pages, currentPageId: "guides" })).toMatchObject({ prev: { title: "Configure", path: "/docs/start/config" }, next: null });
	});

	it("goes down into a group before moving on", () => {
		expect(buildDocsBound({ pages, currentPageId: "start" })).toMatchObject({ prev: { title: "Docs" }, next: { title: "Install" } });
		expect(buildDocsBound({ pages, currentPageId: "config" })).toMatchObject({ prev: { title: "Install" }, next: { title: "Guides" } });
	});

	it("skips a group label that can't be opened", () => {
		const hiddenStart = { ...start, status: "draft" };
		expect(buildDocsBound({ pages: [docs, hiddenStart, install, config, guides], currentPageId: "docs" }).next?.title).toBe("Install");
	});
});

describe("buildDocsBound breadcrumbs and addresses", () => {
	it("runs from the root down to the current page", () => {
		const { breadcrumbs } = buildDocsBound({ pages: [docs, start, install], currentPageId: "install" });
		expect(breadcrumbs).toEqual([
			{ title: "Docs", path: "/docs" },
			{ title: "Getting started", path: "/docs/start" },
			{ title: "Install", path: "/docs/start/install" },
		]);
	});

	it("starts at the chosen root", () => {
		const { breadcrumbs } = buildDocsBound({ pages: [docs, start, install], currentPageId: "install", rootPageId: "start" });
		expect(breadcrumbs.map((crumb) => crumb.title)).toEqual(["Getting started", "Install"]);
	});

	it("gives no link to a crumb visitors can't open", () => {
		const hiddenStart = { ...start, status: "draft" };
		const { breadcrumbs } = buildDocsBound({ pages: [docs, hiddenStart, install], currentPageId: "install" });
		expect(breadcrumbs[1]).toEqual({ title: "Getting started", path: null });
	});

	it("gives the markdown address of the current page", () => {
		expect(buildDocsBound({ pages: [docs, start], currentPageId: "start" }).markdownPath).toBe("/docs/start.md");
	});
});

describe("pickTocHeadings and readers", () => {
	it("keeps only h2 and h3 with an id and text", () => {
		expect(
			pickTocHeadings([
				{ id: "a", text: "A", depth: 1 },
				{ id: "b", text: "B", depth: 2 },
				{ id: "c", text: "C", depth: 3 },
				{ id: "d", text: "D", depth: 4 },
				{ id: "", text: "E", depth: 2 },
			]),
		).toEqual([
			{ id: "b", text: "B", level: 2 },
			{ id: "c", text: "C", level: 3 },
		]);
	});

	it("reads content forgivingly", () => {
		expect(readDocsLayoutContent(undefined)).toEqual({ rootPageId: "", showToc: true, showPrevNext: true, showBreadcrumbs: true, copyPage: true });
		expect(readDocsLayoutContent({ kind: "structured", data: { rootPageId: 4, showToc: "no", copyPage: false } })).toMatchObject({ rootPageId: "", showToc: true, copyPage: false });
	});

	it("reads bound data back, and nothing from a page that wasn't bound", () => {
		const bound = buildDocsBound({ pages: [docs, start], currentPageId: "start" });
		expect(readDocsBound({ kind: "structured", data: { docs: bound } })).toEqual(bound);
		expect(readDocsBound({ kind: "structured", data: {} })).toBeNull();
		expect(readDocsBound({ kind: "structured", data: { docs: { tree: "bad", headings: [{ id: "x", level: 5 }] } } })).toMatchObject({ tree: [], headings: [] });
	});
});
