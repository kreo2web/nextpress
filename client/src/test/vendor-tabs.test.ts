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
