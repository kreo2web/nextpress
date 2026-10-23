import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { bindDocsLayoutBlocks } from "@shared/blocks/bind-docs-layout";
import { getBlockComponent } from "../../../renderer/react/render-helpers";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/docs.js"), "utf8");

const block = (overrides: Partial<BlockConfig> & { id: string; name: string }): BlockConfig => ({
	type: "block",
	parentId: null,
	label: overrides.name,
	category: "basic",
	content: { kind: "structured", data: {} },
	styles: {},
	settings: {},
	...overrides,
});

const docs = block({
	id: "docs1",
	name: "core/docs-layout",
	type: "container",
	children: [
		block({ id: "h1", name: "core/heading", content: { kind: "text", value: "First part", level: 2 } }),
		block({ id: "h2", name: "core/heading", content: { kind: "text", value: "Second part", level: 2 } }),
	],
});

const pages = [
	{ id: "docs", title: "Docs", slug: "docs", parentId: null, menuOrder: 0, status: "publish", password: null },
	{ id: "start", title: "Start", slug: "start", parentId: "docs", menuOrder: 1, status: "publish", password: null },
];

const mount = (): { menu: HTMLButtonElement; root: HTMLElement; drawer: HTMLElement } => {
	const [bound] = bindDocsLayoutBlocks({ blocks: [docs], pages, currentPageId: "start" });
	const Component = getBlockComponent("core/docs-layout");
	if (!Component) throw new Error("missing renderer");
	document.body.innerHTML = renderToString(createElement(Component, bound));
	return {
		menu: document.querySelector<HTMLButtonElement>("[data-np-docs-menu]")!,
		root: document.querySelector<HTMLElement>("[data-np-docs]")!,
		drawer: document.querySelector<HTMLElement>("[data-np-docs-drawer]")!,
	};
};

const pressEscape = (): void => {
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
};

describe("/vendor/docs.js on a published page", () => {
	beforeAll(() => {
		new Function(SCRIPT)();
		new Function(SCRIPT)(); // a second load must not double up the listeners
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("opens the drawer from Menu once (not twice) and moves focus into it", () => {
		const { menu, root } = mount();
		menu.focus();
		menu.click();
		expect(root.getAttribute("data-menu-open")).toBe("true");
		expect(menu.getAttribute("aria-expanded")).toBe("true");
		expect(document.activeElement).toBe(document.querySelector("[data-np-docs-close]"));
	});

	it("closes on Esc and puts focus back on Menu", () => {
		const { menu, root } = mount();
		menu.click();
		pressEscape();
		expect(root.getAttribute("data-menu-open")).toBe("false");
		expect(menu.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(menu);
	});

	it("closes from the Close button and from the backdrop", () => {
		const { menu, root } = mount();
		menu.click();
		document.querySelector<HTMLElement>("[data-np-docs-close]")!.click();
		expect(root.getAttribute("data-menu-open")).toBe("false");
		menu.click();
		document.querySelector<HTMLElement>("[data-np-docs-backdrop]")!.click();
		expect(root.getAttribute("data-menu-open")).toBe("false");
		expect(document.activeElement).toBe(menu);
	});

	it("closes after a link in the drawer is followed", () => {
		const { menu, root, drawer } = mount();
		menu.click();
		const link = drawer.querySelector<HTMLAnchorElement>("a")!;
		link.addEventListener("click", (event) => event.preventDefault());
		link.click();
		expect(root.getAttribute("data-menu-open")).toBe("false");
	});

	it("leaves a closed page alone on Esc", () => {
		const { root } = mount();
		pressEscape();
		expect(root.getAttribute("data-menu-open")).toBe("false");
	});

	it("copies the markdown copy of the page and says so on the button, then puts the label back", async () => {
		vi.useFakeTimers();
		const writeText = vi.fn(async () => undefined);
		const fetchMock = vi.fn(async (_url: string) => ({ ok: true, text: async () => "# Start\n" }) as Response);
		vi.stubGlobal("fetch", fetchMock);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		mount();
		const button = document.querySelector<HTMLButtonElement>("[data-np-docs-copy]")!;
		const label = button.querySelector(".np-docs__action-label")!;
		button.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe("/docs/start.md");
		expect(writeText).toHaveBeenCalledWith("# Start\n");
		expect(label.textContent).toBe("Copied");
		await vi.advanceTimersByTimeAsync(2100);
		expect(label.textContent).toBe("Copy page");
	});

	it("says it couldn't copy when the page copy can't be fetched or the clipboard refuses", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 }) as Response));
		Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
		mount();
		const button = document.querySelector<HTMLButtonElement>("[data-np-docs-copy]")!;
		const label = button.querySelector(".np-docs__action-label")!;
		button.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(label.textContent).toBe("Couldn't copy. Try again.");
		await vi.advanceTimersByTimeAsync(2100);
		expect(label.textContent).toBe("Copy page");
	});

	it("scrolls smoothly to a heading, but lets the browser jump when motion is reduced", () => {
		mount();
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		const link = document.querySelector<HTMLAnchorElement>('.np-docs__toc a[href="#second-part"]')!;
		const smooth = new MouseEvent("click", { bubbles: true, cancelable: true });
		link.dispatchEvent(smooth);
		expect(smooth.defaultPrevented).toBe(true);
		expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		const jump = new MouseEvent("click", { bubbles: true, cancelable: true });
		link.dispatchEvent(jump);
		expect(jump.defaultPrevented).toBe(false);
		expect(scroll).toHaveBeenCalledTimes(1);
		expect(link.getAttribute("aria-current")).toBe("true");
	});

	// Last on purpose: it installs the script again (with the page already drawn) so the reading highlight can start.
	it("marks the link of the heading being read", () => {
		const entries: Array<(list: Array<{ target: Element; isIntersecting: boolean }>) => void> = [];
		class FakeObserver {
			constructor(callback: (list: Array<{ target: Element; isIntersecting: boolean }>) => void) {
				entries.push(callback);
			}
			observe(): void {}
			disconnect(): void {}
		}
		vi.stubGlobal("IntersectionObserver", FakeObserver);
		mount();
		delete (window as unknown as Record<string, boolean | undefined>).__npDocsInstalled;
		new Function(SCRIPT)();
		const second = document.getElementById("second-part")!;
		entries[entries.length - 1]([{ target: second, isIntersecting: true }]);
		const current = Array.from(document.querySelectorAll(".np-docs__toc a[aria-current='true']")).map((link) => link.textContent);
		expect(current).toEqual(["Second part"]);
	});
});
