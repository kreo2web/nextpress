import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { getBlockComponent } from "../../../renderer/react/render-helpers";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/search.js"), "utf8");

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

const mountHtml = (data: Record<string, string> = {}): void => {
	const Component = getBlockComponent("core/search");
	if (!Component) throw new Error("core/search is not registered");
	const holder = document.createElement("div");
	holder.className = "test-mount";
	holder.innerHTML = renderToString(createElement(Component, searchBlock(data)));
	document.body.appendChild(holder);
};

const answerWith = (body: object, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });
const dialog = (): HTMLDialogElement | null => document.querySelector("dialog.np-search-dialog");
const field = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".np-search-dialog__input") as HTMLInputElement;
const status = (): string => document.querySelector(".np-search-dialog__status")?.textContent ?? "";
const press = (target: EventTarget, init: KeyboardEventInit): KeyboardEvent => {
	const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
};
const type = async (text: string): Promise<void> => {
	field().value = text;
	field().dispatchEvent(new Event("input", { bubbles: true }));
	await vi.advanceTimersByTimeAsync(250);
};

describe("/vendor/search.js on a published page", () => {
	beforeAll(() => {
		// jsdom has no native dialog behaviour; this stands in for what a browser does.
		const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
		proto.showModal = function showModal(this: HTMLDialogElement) {
			this.setAttribute("open", "");
		};
		proto.close = function close(this: HTMLDialogElement) {
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		};
		new Function(SCRIPT)();
	});

	afterEach(() => {
		dialog()?.close();
		document.querySelectorAll(".test-mount").forEach((node) => node.remove());
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("renders the button with its words and a shortcut hint", () => {
		mountHtml({ label: "Find docs", placeholder: "Search the docs" });
		const button = document.querySelector<HTMLButtonElement>("[data-np-search]");
		expect(button?.textContent).toContain("Find docs");
		expect(button?.getAttribute("data-placeholder")).toBe("Search the docs");
		expect(button?.querySelector("kbd")?.textContent).toContain("K");
	});

	it("opens an accessible dialog with the focus in the search box when the button is pressed", () => {
		mountHtml({ placeholder: "Search the docs" });
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		expect(dialog()?.hasAttribute("open")).toBe(true);
		expect(dialog()?.getAttribute("aria-label")).toBe("Search");
		expect(document.activeElement).toBe(field());
		expect(field().getAttribute("placeholder")).toBe("Search the docs");
		expect(field().getAttribute("role")).toBe("combobox");
	});

	it("closes on Esc", () => {
		mountHtml();
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		press(field(), { key: "Escape" });
		expect(dialog()?.hasAttribute("open")).toBe(false);
	});

	it("opens on Ctrl+K and Cmd+K, but not while typing in a field", () => {
		mountHtml();
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

	it("searches after a short pause, then moves with the arrow keys and opens a result with Enter", async () => {
		vi.useFakeTimers();
		const fetchMock = answerWith({
			results: [
				{ title: "Install", path: "/install", snippet: "Download it" },
				{ title: "Backups", path: "/install#backups", snippet: "Copy uploads" },
			],
		});
		vi.stubGlobal("fetch", fetchMock);
		mountHtml();
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();

		field().value = "inst";
		field().dispatchEvent(new Event("input", { bubbles: true }));
		await vi.advanceTimersByTimeAsync(100);
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(150);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0][0])).toBe("/api/public/search?q=inst");

		const links = document.querySelectorAll<HTMLAnchorElement>(".np-search-dialog__result");
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute("href")).toBe("/install");
		press(field(), { key: "ArrowDown" });
		expect(links[0].getAttribute("aria-selected")).toBe("true");
		press(field(), { key: "ArrowDown" });
		expect(links[1].getAttribute("aria-selected")).toBe("true");
		expect(field().getAttribute("aria-activedescendant")).toBe(links[1].id);
		press(field(), { key: "ArrowUp" });
		expect(links[0].getAttribute("aria-selected")).toBe("true");

		const opened: string[] = [];
		links.forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); opened.push(link.getAttribute("href") ?? ""); }));
		press(field(), { key: "ArrowDown" });
		press(field(), { key: "Enter" });
		expect(opened).toEqual(["/install#backups"]);
	});

	it("says so in plain words when nothing matches", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", answerWith({ results: [] }));
		mountHtml();
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		await type("zzz");
		expect(status()).toBe("No pages match that.");
	});

	it("says so in plain words when search fails", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		mountHtml();
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		await type("abc");
		expect(status()).toBe("Search isn't working right now. Try again in a moment.");
	});

	it("shows the server's plain message when it asks the reader to wait", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", answerWith({ message: "Too many searches in a row. Wait a moment and try again." }, false));
		mountHtml();
		document.querySelector<HTMLButtonElement>("[data-np-search]")?.click();
		await type("abc");
		expect(status()).toBe("Too many searches in a row. Wait a moment and try again.");
	});

	it("installs once even if the script is included twice", () => {
		const listen = vi.spyOn(document, "addEventListener");
		new Function(SCRIPT)();
		expect(listen).not.toHaveBeenCalled();
		listen.mockRestore();
	});
});
