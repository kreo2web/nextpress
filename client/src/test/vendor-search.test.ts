import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { getBlockComponent } from "../../../renderer/react/render-helpers";
import { buildSearchIndexPayload } from "../../../server/lib/site-search/build-search-index-payload";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/search.js"), "utf8");
// The real browser build of MiniSearch, the same file the server hands out as /vendor/minisearch.js.
const MINISEARCH_BUILD = readFileSync(resolve(here, "../../../node_modules/minisearch/dist/umd/index.js"), "utf8");

const text = (id: string, name: string, value: string, level?: number): BlockConfig =>
	({ id, name, type: "block", parentId: null, content: { kind: "text", value, ...(level ? { level } : {}) } }) as BlockConfig;

const PAGES = [
	{
		id: "install",
		title: "Install NextPress",
		path: "install",
		blocks: [
			text("a", "core/paragraph", "Download the release first."),
			text("b", "core/heading", "Package managers", 2),
			text("c", "core/paragraph", "Use pnpm to install the packages, or npm if you prefer."),
		],
	},
	{ id: "about", title: "About us", path: "about", blocks: [text("d", "core/paragraph", "We make websites simple.")] },
	{ id: "evil", title: "<img src=x onerror=alert(1)>", path: "guides/evil", blocks: [text("e", "core/paragraph", "Nothing to see here.")] },
];

const searchBlock = (data: Record<string, string>): BlockConfig => ({
	id: "s1",
	name: "core/search",
	type: "block",
	parentId: null,
	label: "Search",
	category: "advanced",
	content: { kind: "structured", data },
	styles: {},
	settings: {},
});

const mountSearchBlock = (data: Record<string, string> = {}): void => {
	const Component = getBlockComponent("core/search");
	if (!Component) throw new Error("core/search is not registered");
	const holder = document.createElement("div");
	holder.className = "test-mount";
	holder.innerHTML = renderToString(createElement(Component, searchBlock(data)));
	document.body.appendChild(holder);
};

const dialog = (): HTMLDialogElement | null => document.querySelector("dialog.np-search-dialog");
const field = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".np-search-dialog__input") as HTMLInputElement;
const status = (): string => document.querySelector(".np-search-dialog__status")?.textContent ?? "";
const resultLinks = (): HTMLAnchorElement[] => Array.from(document.querySelectorAll<HTMLAnchorElement>(".np-search-dialog__result"));
const press = (target: EventTarget, init: KeyboardEventInit): KeyboardEvent => {
	const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
};
const type = (value: string): void => {
	field().value = value;
	field().dispatchEvent(new Event("input", { bubbles: true }));
};
const whenReady = () => vi.waitFor(() => expect(status()).not.toBe("Loading search…"));

let indexFetches = 0;
let libraryLoads = 0;
let otherFetches: string[] = [];
let indexAnswer: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

describe("/vendor/search.js on a published page", () => {
	beforeAll(async () => {
		const { payload } = await buildSearchIndexPayload({ pages: PAGES, builtAt: new Date("2026-10-24T10:00:00Z") });
		indexAnswer = async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(payload)) });

		// jsdom has no native dialog behaviour; this stands in for what a browser does.
		const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
		proto.showModal = function showModal(this: HTMLDialogElement) {
			this.setAttribute("open", "");
		};
		proto.close = function close(this: HTMLDialogElement) {
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		};
		// jsdom does not fetch scripts; hand it the real MiniSearch build when the page asks for /vendor/minisearch.js.
		const append = document.head.appendChild.bind(document.head);
		vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
			if (node instanceof HTMLScriptElement && node.src.endsWith("/vendor/minisearch.js")) {
				libraryLoads += 1;
				new Function(MINISEARCH_BUILD).call(window);
				queueMicrotask(() => node.onload?.(new Event("load")));
				return node;
			}
			return append(node);
		});
		vi.stubGlobal("fetch", async (url: string) => {
			if (String(url) === "/api/public/docs-index") {
				indexFetches += 1;
				return indexAnswer();
			}
			otherFetches.push(String(url));
			throw new Error(`unexpected request ${url}`);
		});
		new Function(SCRIPT)();
	});

	afterEach(() => {
		dialog()?.close();
	});

	afterAll(() => {
		document.querySelectorAll(".test-mount").forEach((node) => node.remove());
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("renders the button with its words and a shortcut hint", () => {
		mountSearchBlock({ label: "Find docs", placeholder: "Search the docs" });
		const button = document.querySelector<HTMLButtonElement>("[data-np-search]");
		expect(button?.textContent).toContain("Find docs");
		expect(button?.getAttribute("data-placeholder")).toBe("Search the docs");
		expect(button?.querySelector("kbd")?.textContent).toContain("K");
	});

	it("loads nothing until the reader opens search", () => {
		expect(indexFetches).toBe(0);
		expect(libraryLoads).toBe(0);
	});

	it("opens on a click, with the focus in the box, a quiet loading line, then one index and one library load", async () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		expect(dialog()?.hasAttribute("open")).toBe(true);
		expect(dialog()?.getAttribute("aria-label")).toBe("Search");
		expect(document.activeElement).toBe(field());
		expect(field().getAttribute("placeholder")).toBe("Search the docs");
		expect(field().getAttribute("role")).toBe("combobox");
		expect(status()).toBe("Loading search…");
		await whenReady();
		expect(status()).toBe("");
		expect(indexFetches).toBe(1);
		expect(libraryLoads).toBe(1);
	});

	it("finds the right page and section for 'pnpm', wraps the matches in <mark>, and makes no request while typing", async () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		for (const typed of ["p", "pn", "pnp", "pnpm"]) type(typed);
		const links = resultLinks();
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("/install#package-managers");
		expect(links[0].querySelector(".np-search-dialog__title")?.textContent).toContain("Install NextPress");
		expect(links[0].querySelector(".np-search-dialog__section")?.textContent).toBe("Package managers");
		const marks = Array.from(links[0].querySelectorAll("mark")).map((mark) => mark.textContent);
		expect(marks).toContain("pnpm");
		expect(indexFetches).toBe(1);
		expect(otherFetches).toEqual([]);
	});

	it("matches the start of a word and shows each page once", () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		type("inst");
		const links = resultLinks();
		expect(links.map((link) => link.getAttribute("href")?.split("#")[0])).toEqual(["/install"]);
		expect(links[0].querySelector(".np-search-dialog__title mark")?.textContent).toBe("Install");
	});

	it("moves with the arrow keys and opens a result with Enter", () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		type("s");
		const links = resultLinks();
		expect(links.length).toBeGreaterThan(1);
		const opened: string[] = [];
		links.forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); opened.push(link.getAttribute("href") ?? ""); }));
		press(field(), { key: "ArrowDown" });
		expect(links[0].getAttribute("aria-selected")).toBe("true");
		press(field(), { key: "ArrowDown" });
		expect(links[1].getAttribute("aria-selected")).toBe("true");
		expect(field().getAttribute("aria-activedescendant")).toBe(links[1].id);
		press(field(), { key: "ArrowUp" });
		expect(links[0].getAttribute("aria-selected")).toBe("true");
		press(field(), { key: "ArrowDown" });
		press(field(), { key: "Enter" });
		expect(opened).toEqual([links[1].getAttribute("href")]);
		expect(dialog()?.hasAttribute("open")).toBe(false);
	});

	it("closes on Esc", () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		press(field(), { key: "Escape" });
		expect(dialog()?.hasAttribute("open")).toBe(false);
	});

	it("shows a page title that looks like HTML as plain text", () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		type("nothing");
		const links = resultLinks();
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("/guides/evil");
		expect(links[0].querySelector(".np-search-dialog__title")?.textContent).toBe("<img src=x onerror=alert(1)>");
		expect(dialog()?.querySelector("img")).toBeNull();
		type("<img");
		expect(dialog()?.querySelector("img")).toBeNull();
		expect(resultLinks()[0].querySelector(".np-search-dialog__title")?.textContent).toBe("<img src=x onerror=alert(1)>");
	});

	it("says so in plain words when nothing matches, with the reader's words in it", () => {
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		type("zzzqq");
		expect(status()).toBe('No pages match "zzzqq". Try another word.');
		expect(resultLinks()).toHaveLength(0);
		type("");
		expect(status()).toBe("");
	});

	it("opens on Ctrl+K and Cmd+K, but not while typing in a field", () => {
		const outside = document.createElement("input");
		document.body.appendChild(outside);
		outside.focus();
		press(outside, { key: "k", ctrlKey: true });
		expect(dialog()?.hasAttribute("open") ?? false).toBe(false);
		outside.remove();

		const ctrl = press(document.body, { key: "k", ctrlKey: true });
		expect(ctrl.defaultPrevented).toBe(true);
		expect(dialog()?.hasAttribute("open")).toBe(true);
		dialog()?.close();
		press(document.body, { key: "k", metaKey: true });
		expect(dialog()?.hasAttribute("open")).toBe(true);
	});

	it("opens from any element marked data-np-search-open", () => {
		const opener = document.createElement("a");
		opener.setAttribute("data-np-search-open", "");
		opener.setAttribute("data-placeholder", "Search the manual");
		opener.href = "#";
		opener.className = "test-mount";
		document.body.appendChild(opener);
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		opener.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
		expect(dialog()?.hasAttribute("open")).toBe(true);
		expect(field().getAttribute("placeholder")).toBe("Search the manual");
	});

	it("after all of that, the index was fetched exactly once and nothing else was requested", () => {
		expect(indexFetches).toBe(1);
		expect(libraryLoads).toBe(1);
		expect(otherFetches).toEqual([]);
	});

	it("installs once even if the script is included twice", () => {
		const listen = vi.spyOn(document, "addEventListener");
		new Function(SCRIPT)();
		expect(listen).not.toHaveBeenCalled();
		listen.mockRestore();
	});
});

describe("/vendor/search.js when the index cannot be had", () => {
	it("says so in plain words, logs the cause, and tries again next time it opens", async () => {
		document.body.innerHTML = "";
		vi.resetModules();
		delete (window as { __npSearch?: boolean }).__npSearch;
		delete (window as { MiniSearch?: unknown }).MiniSearch;
		const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
		let attempts = 0;
		vi.stubGlobal("fetch", async () => {
			attempts += 1;
			if (attempts === 1) throw new Error("offline");
			const { payload } = await buildSearchIndexPayload({ pages: PAGES, builtAt: new Date() });
			return { ok: true, status: 200, json: async () => payload };
		});
		const append = Node.prototype.appendChild;
		vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
			if (node instanceof HTMLScriptElement && node.src.endsWith("/vendor/minisearch.js")) {
				new Function(MINISEARCH_BUILD).call(window);
				queueMicrotask(() => node.onload?.(new Event("load")));
				return node;
			}
			return append.call(document.head, node) as T;
		});
		// A second copy of the script on a clean page (the first copy's listeners belong to the old, emptied page).
		new Function(SCRIPT)();
		const opener = document.createElement("button");
		opener.setAttribute("data-np-search-open", "");
		document.body.appendChild(opener);

		opener.click();
		await vi.waitFor(() => expect(status()).toBe("Search isn't available right now. Try again in a moment."));
		expect(logged).toHaveBeenCalled();
		dialog()?.close();

		opener.click();
		await vi.waitFor(() => expect(status()).toBe(""));
		type("pnpm");
		expect(resultLinks()).toHaveLength(1);
		expect(attempts).toBe(2);
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});
});
