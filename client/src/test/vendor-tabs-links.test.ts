import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { getBlockComponent } from "../../../renderer/react/render-helpers";
import { tabSlugs } from "@shared/blocks/tabs-model";

const SCRIPT = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../public/vendor/tabs.js"), "utf8");

const tab = (id: string, title: string, parentId: string): BlockConfig => ({
	id, name: "core/tab", type: "container", parentId, label: "Tab", category: "layout",
	content: { kind: "structured", data: { title } }, styles: {}, settings: {}, children: [],
});
const tabsBlock = (id: string, titles: string[], data: Record<string, boolean> = {}): BlockConfig => ({
	id, name: "core/tabs", type: "container", parentId: null, label: "Tabs", category: "layout",
	content: { kind: "structured", data }, styles: {}, settings: {}, children: titles.map((t, i) => tab(`${id}-${i}`, t, id)),
});
const html = (block: BlockConfig): string => {
	const C = getBlockComponent(block.name);
	if (!C) throw new Error("missing renderer");
	return renderToString(createElement(C, block));
};
const load = (): void => {
	if (!window.matchMedia("(prefers-reduced-motion: reduce)")) window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
	delete (window as unknown as { __npTabsInstalled?: boolean }).__npTabsInstalled;
	new Function(SCRIPT)();
};
const tabsIn = (id: string): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>(`[id^="np-tabs-${id}-tab-"]`));
const selected = (id: string): string | undefined => tabsIn(id).find((t) => t.getAttribute("aria-selected") === "true")?.textContent ?? undefined;

describe("tab link names", () => {
	it("are lower case words joined by -, unique, and tab-<n> for an empty title", () => {
		expect(tabSlugs(["npm", "npm", "npm", "Getting Started!", "", "  "])).toEqual(["npm", "npm-2", "npm-3", "getting-started", "tab-5", "tab-6"]);
	});
	it("show in published markup, two tabs titled npm give npm and npm-2", () => {
		const out = html(tabsBlock("t", ["npm", "npm", "pnpm"]));
		expect(Array.from(out.matchAll(/data-np-tab-slug="([^"]+)"/g), (m) => m[1])).toEqual(["npm", "npm-2", "pnpm"]);
	});
	it("are left out when linkable is off", () => {
		expect(html(tabsBlock("t", ["a", "b"], { linkable: false }))).not.toContain("data-np-tab-slug");
	});
});

describe("/vendor/tabs.js deep links", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		window.history.replaceState(null, "", "/");
	});
	const mount = (blocks: BlockConfig[], hash = ""): void => {
		window.history.replaceState(null, "", "/" + hash);
		document.body.innerHTML = blocks.map(html).join("");
		Element.prototype.scrollIntoView = vi.fn();
		load();
	};

	it("writes #slug with replaceState when a tab is clicked, without adding history", () => {
		const length = window.history.length;
		const spy = vi.spyOn(window.history, "replaceState");
		mount([tabsBlock("t", ["npm", "pnpm"])]);
		spy.mockClear();
		tabsIn("t")[1].click();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(window.location.hash).toBe("#pnpm");
		expect(window.history.length).toBe(length);
		spy.mockRestore();
	});

	it("also writes it from the keyboard", () => {
		mount([tabsBlock("t", ["npm", "pnpm"])]);
		tabsIn("t")[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
		expect(window.location.hash).toBe("#pnpm");
	});

	it("opens the tab named in the address on load and scrolls its Tabs block into view", () => {
		mount([tabsBlock("t", ["npm", "pnpm", "yarn"])], "#pnpm");
		expect(selected("t")).toBe("pnpm");
		expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
	});

	it("scrolls instantly under reduced motion", () => {
		const original = window.matchMedia;
		window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q })) as typeof window.matchMedia;
		mount([tabsBlock("t", ["npm", "pnpm"])], "#pnpm");
		window.matchMedia = original;
		expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
	});

	it("follows hashchange", () => {
		mount([tabsBlock("t", ["npm", "pnpm"])]);
		window.location.hash = "#pnpm";
		window.dispatchEvent(new HashChangeEvent("hashchange"));
		expect(selected("t")).toBe("pnpm");
	});

	it("leaves a heading hash alone: no tab changes, no scroll, hash kept", () => {
		mount([tabsBlock("t", ["npm", "pnpm"])], "#installation");
		expect(selected("t")).toBe("npm");
		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
		expect(window.location.hash).toBe("#installation");
	});

	it("keeps names apart across two Tabs blocks (npm, npm-2) and opens the right one", () => {
		mount([tabsBlock("a", ["npm", "pnpm"]), tabsBlock("b", ["npm", "pnpm"])], "#npm-2");
		expect(selected("b")).toBe("npm");
		tabsIn("b")[1].click();
		expect(window.location.hash).toBe("#pnpm-2");
		expect(selected("a")).toBe("npm");
	});

	it("writes nothing and ignores the hash when linkable is off", () => {
		mount([tabsBlock("t", ["npm", "pnpm"], { linkable: false })], "#pnpm");
		expect(selected("t")).toBe("npm");
		tabsIn("t")[1].click();
		expect(selected("t")).toBe("pnpm");
		expect(window.location.hash).toBe("#pnpm"); // untouched: it was the starting hash
		window.history.replaceState(null, "", "/");
		tabsIn("t")[0].click();
		expect(window.location.hash).toBe("");
	});

	it("code groups never write or read the hash", () => {
		document.body.innerHTML = `<div class="wp-block-tabs np-code-group" data-np-tabs="">
			<div role="tablist" data-np-sync="npm|pnpm" data-np-remember="false">
				<button role="tab" id="g-t0" aria-controls="g-p0" aria-selected="true" data-np-tab-slug="npm">npm</button>
				<button role="tab" id="g-t1" aria-controls="g-p1" aria-selected="false" data-np-tab-slug="pnpm">pnpm</button></div>
			<div><div role="tabpanel" id="g-p0"></div><div role="tabpanel" id="g-p1" hidden></div></div></div>`;
		window.history.replaceState(null, "", "/#pnpm");
		load();
		expect(document.getElementById("g-t0")?.getAttribute("aria-selected")).toBe("true");
		window.history.replaceState(null, "", "/");
		(document.getElementById("g-t1") as HTMLElement).click();
		expect(document.getElementById("g-t1")?.getAttribute("aria-selected")).toBe("true");
		expect(window.location.hash).toBe("");
	});
});
