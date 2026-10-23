import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CodeView } from "@shared/markdown";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(resolve(here, "../../public/vendor/code.js"), "utf8");

/** Runs the published-page script once, as the page's <script> tag would. */
const runScript = (): void => {
	new Function(SCRIPT)();
};

describe("/vendor/code.js on a published page", () => {
	const writeText = vi.fn<(text: string) => Promise<void>>();

	beforeAll(() => {
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		runScript();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		writeText.mockReset();
		vi.useRealTimers();
	});

	it("copies the code of the block whose button was pressed (no line numbers), then says so for a moment", async () => {
		vi.useFakeTimers();
		writeText.mockResolvedValue();
		document.body.innerHTML = renderToString(
			createElement("div", null, [
				createElement(CodeView, { key: "a", code: "npm install", language: "bash", showLineNumbers: true }),
				createElement(CodeView, { key: "b", code: "const a = 1\nconst b = 2", language: "ts", showLineNumbers: true }),
			]),
		);
		const second = document.querySelectorAll<HTMLButtonElement>("[data-np-copy]")[1];
		second.click();
		await vi.waitFor(() => expect(second.textContent).toBe("Copied"));
		expect(writeText).toHaveBeenCalledWith("const a = 1\nconst b = 2");
		vi.advanceTimersByTime(1600);
		expect(second.textContent).toBe("Copy");
	});

	it("tells the reader to copy by hand when the browser refuses", async () => {
		writeText.mockRejectedValue(new Error("denied"));
		document.body.innerHTML = renderToString(createElement(CodeView, { code: "x", language: "js" }));
		const button = document.querySelector<HTMLButtonElement>("[data-np-copy]");
		button?.click();
		await vi.waitFor(() => expect(button?.textContent).toBe("Select and copy"));
	});

	it("installs its listener once even if the script is included twice", () => {
		const listen = vi.spyOn(document, "addEventListener");
		runScript();
		expect(listen).not.toHaveBeenCalled();
		listen.mockRestore();
	});
});
