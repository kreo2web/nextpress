import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { DOCS_ZOOM_CSS } from "@shared/blocks/docs-zoom-css";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/docs.js"), "utf8");

/**
 * The page is in place before the script runs, as on a published page. jsdom's dialog is stood in
 * for so opening and closing behave as in a browser (close fires "close").
 */
beforeAll(() => {
	HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
		this.removeAttribute("open");
		this.dispatchEvent(new Event("close"));
	};
	document.body.innerHTML = `
		<div data-np-docs>
			<div class="np-docs__content np-prose">
				<p><img src="/uploads/chart.png" alt="A chart of builds"></p>
				<a href="/elsewhere"><img src="/uploads/linked.png" alt="Linked picture"></a>
			</div>
		</div>
		<img src="/uploads/outside.png" alt="Not in the docs">`;
	new Function(SCRIPT)();
});

const picture = (): HTMLImageElement => document.querySelector<HTMLImageElement>('img[alt="A chart of builds"]')!;

describe("/vendor/docs.js picture zoom", () => {
	it("makes docs pictures openable by mouse and keyboard, but not linked pictures or pictures outside the docs", () => {
		expect(picture().getAttribute("role")).toBe("button");
		expect(picture().getAttribute("tabindex")).toBe("0");
		expect(picture().getAttribute("aria-label")).toBe("A chart of builds. Open larger");
		expect(document.querySelector('img[alt="Linked picture"]')!.hasAttribute("data-np-zoom")).toBe(false);
		expect(document.querySelector('img[alt="Not in the docs"]')!.hasAttribute("data-np-zoom")).toBe(false);
	});

	it("opens the picture larger on click, with Close focused, and gives focus back on close", () => {
		picture().click();
		const dialog = document.querySelector<HTMLDialogElement>("dialog.np-zoom")!;
		expect(dialog).not.toBeNull();
		expect(dialog.getAttribute("aria-label")).toBe("Picture: A chart of builds");
		expect(dialog.querySelector("img")!.getAttribute("src")).toBe(picture().src);
		expect(document.activeElement).toBe(dialog.querySelector(".np-zoom__close"));
		dialog.querySelector<HTMLButtonElement>(".np-zoom__close")!.click();
		expect(document.querySelector("dialog.np-zoom")).toBeNull();
		expect(document.activeElement).toBe(picture());
	});

	it("opens with Enter, and closes with a click on the big picture", () => {
		picture().focus();
		picture().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		const dialog = document.querySelector<HTMLDialogElement>("dialog.np-zoom")!;
		expect(dialog).not.toBeNull();
		dialog.querySelector("img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(document.querySelector("dialog.np-zoom")).toBeNull();
	});

	it("only moves when the reader allows motion", () => {
		expect(DOCS_ZOOM_CSS).toContain("@media (prefers-reduced-motion: no-preference) { .np-zoom[open] { animation");
		expect(DOCS_ZOOM_CSS).toContain("cursor: zoom-in");
	});
});
