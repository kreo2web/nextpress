import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { getBlockComponent } from "../../../renderer/react/render-helpers";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/tabs.js"), "utf8");

const tab = (id: string, title: string): BlockConfig => ({
	id,
	name: "core/tab",
	type: "container",
	parentId: "tabs1",
	label: "Tab",
	category: "layout",
	content: { kind: "structured", data: { title } },
	styles: {},
	settings: {},
	children: [],
});

const tabsBlock: BlockConfig = {
	id: "tabs1",
	name: "core/tabs",
	type: "container",
	parentId: null,
	label: "Tabs",
	category: "layout",
	content: { kind: "structured", data: {} },
	styles: {},
	settings: {},
	children: [tab("a", "One"), tab("b", "Two"), tab("c", "Three")],
};

const mount = (): HTMLButtonElement[] => {
	const Component = getBlockComponent("core/tabs");
	if (!Component) throw new Error("missing renderer");
	document.body.innerHTML = renderToString(createElement(Component, tabsBlock));
	return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
};

const key = (el: Element, name: string): void => {
	el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
};

const openPanels = (): string[] =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'))
		.filter((panel) => !panel.hidden)
		.map((panel) => panel.id);

describe("/vendor/tabs.js on a published page", () => {
	beforeAll(() => {
		new Function(SCRIPT)();
		new Function(SCRIPT)(); // a second load must not double up the listeners
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("opens the tab that was clicked and keeps aria, tabindex and hidden in step", () => {
		const tabs = mount();
		tabs[2].click();
		expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true"]);
		expect(tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
		expect(openPanels()).toEqual([tabs[2].getAttribute("aria-controls")]);
	});

	it("moves with the arrow keys, wrapping at both ends, and focuses the new tab", () => {
		const tabs = mount();
		tabs[0].focus();
		key(tabs[0], "ArrowLeft");
		expect(document.activeElement).toBe(tabs[2]);
		expect(tabs[2].getAttribute("aria-selected")).toBe("true");
		key(tabs[2], "ArrowRight");
		expect(document.activeElement).toBe(tabs[0]);
		expect(openPanels()).toEqual([tabs[0].getAttribute("aria-controls")]);
	});

	it("jumps to the first and last tab with Home and End", () => {
		const tabs = mount();
		key(tabs[0], "End");
		expect(tabs[2].getAttribute("aria-selected")).toBe("true");
		key(tabs[2], "Home");
		expect(tabs[0].getAttribute("aria-selected")).toBe("true");
	});

	it("ignores other keys", () => {
		const tabs = mount();
		const event = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
		tabs[0].dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});
});

describe("/vendor/tabs.js code groups", () => {
	const group = (id: string, sync: string, remember: boolean): string => `
		<div data-np-tabs="">
			<div role="tablist" data-np-sync="${sync}" data-np-remember="${remember}">
				${sync
					.split("|")
					.map(
						(name, index) =>
							`<button type="button" role="tab" id="${id}-t${index}" aria-controls="${id}-p${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${name}</button>`,
					)
					.join("")}
			</div>
			<div>${sync
				.split("|")
				.map((_, index) => `<div role="tabpanel" id="${id}-p${index}" ${index === 0 ? "" : "hidden"}></div>`)
				.join("")}</div>
		</div>`;

	const tabNamed = (id: string, index: number): HTMLElement => document.getElementById(`${id}-t${index}`) as HTMLElement;
	const selectedIn = (id: string): string | null =>
		document.querySelector(`[id^="${id}-t"][aria-selected="true"]`)?.textContent ?? null;
	const KEY = "np-tabs-choice";

	const makeStorage = (initial: Record<string, string> = {}) => {
		const store = new Map(Object.entries(initial));
		return {
			getItem: (name: string) => store.get(name) ?? null,
			setItem: (name: string, value: string) => void store.set(name, value),
			store,
		};
	};
	const useStorage = (storage: object): void => {
		Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
	};
	const load = (): void => {
		delete (window as unknown as { __npTabsInstalled?: boolean }).__npTabsInstalled;
		new Function(SCRIPT)();
	};

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("picks the same tab name in every group with the same names", () => {
		useStorage(makeStorage());
		document.body.innerHTML = group("a", "npm|pnpm|yarn", true) + group("b", "npm|pnpm|yarn", true) + group("c", "npm|bun", true);
		load();
		tabNamed("a", 1).click();
		expect(selectedIn("a")).toBe("pnpm");
		expect(selectedIn("b")).toBe("pnpm");
		expect(selectedIn("c")).toBe("npm"); // different names: left alone
		const panel = document.getElementById("b-p1") as HTMLElement;
		expect(panel.hidden).toBe(false);
		expect((document.getElementById("b-p0") as HTMLElement).hidden).toBe(true);
	});

	it("remembers the choice in localStorage and applies it on the next page", () => {
		const storage = makeStorage();
		useStorage(storage);
		document.body.innerHTML = group("a", "npm|pnpm", true);
		load();
		tabNamed("a", 1).click();
		expect(JSON.parse(storage.store.get(KEY) ?? "{}")).toEqual({ "npm|pnpm": "pnpm" });

		document.body.innerHTML = group("n", "npm|pnpm", true);
		load();
		expect(selectedIn("n")).toBe("pnpm");
		expect((document.getElementById("n-p1") as HTMLElement).hidden).toBe(false);
	});

	it("does not remember when the group says not to, but still syncs", () => {
		const storage = makeStorage();
		useStorage(storage);
		document.body.innerHTML = group("a", "npm|pnpm", false) + group("b", "npm|pnpm", false);
		load();
		tabNamed("a", 1).click();
		expect(selectedIn("b")).toBe("pnpm");
		expect(storage.store.has(KEY)).toBe(false);
	});

	it("ignores a saved name the group no longer has", () => {
		useStorage(makeStorage({ [KEY]: JSON.stringify({ "npm|pnpm": "deno" }) }));
		document.body.innerHTML = group("a", "npm|pnpm", true);
		load();
		expect(selectedIn("a")).toBe("npm");
	});

	it("keeps switching when storage throws on read and write", () => {
		useStorage({
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		});
		document.body.innerHTML = group("a", "npm|pnpm", true) + group("b", "npm|pnpm", true);
		expect(() => load()).not.toThrow();
		expect(() => tabNamed("a", 1).click()).not.toThrow();
		expect(selectedIn("a")).toBe("pnpm");
		expect(selectedIn("b")).toBe("pnpm");
	});

	it("keeps groups in step from the keyboard too", () => {
		useStorage(makeStorage());
		document.body.innerHTML = group("a", "npm|pnpm", true) + group("b", "npm|pnpm", true);
		load();
		key(tabNamed("a", 0), "ArrowRight");
		expect(selectedIn("b")).toBe("pnpm");
	});
});
