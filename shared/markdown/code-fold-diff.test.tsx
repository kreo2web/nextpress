import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseCodeFenceMeta } from "./code-meta.js";
import { CodeFrame, CodeView, FOLD_AFTER_LINES } from "./code-view.js";
import { MARKDOWN_CSS } from "./markdown-css.js";
import { MarkdownView } from "./markdown-view.js";

const linesOf = (count: number): string => Array.from({ length: count }, (_, index) => `const line${index + 1} = ${index + 1};`).join("\n");
const fence = (text: string): string => renderToString(<MarkdownView text={text} />);

describe("long code folds to its first lines", () => {
	it("folds a code block longer than the limit, with the line count on the button", () => {
		const html = renderToString(<CodeView code={linesOf(FOLD_AFTER_LINES + 5)} language="ts" />);
		expect(html).toContain("data-folds");
		expect(html).toContain(`Show all <!-- -->${FOLD_AFTER_LINES + 5}<!-- --> lines`);
		expect(html).toContain('class="np-code-fold-input"');
		expect(html).toContain("Show less");
	});

	it("leaves short code alone, and code whose author turned folding off", () => {
		expect(renderToString(<CodeView code={linesOf(FOLD_AFTER_LINES)} language="ts" />)).not.toContain("data-folds");
		expect(renderToString(<CodeFrame language="ts" copyText={linesOf(40)} fold={false} html="x" />)).not.toContain("data-folds");
	});

	it("folds a long fence too, unless it says noFold, and wraps when it says wrap", () => {
		const long = linesOf(30);
		const folded = fence(`\`\`\`ts wrap\n${long}\n\`\`\`\n`);
		expect(folded).toContain("data-folds");
		expect(folded).toContain("data-wrap");
		const open = fence(`\`\`\`ts noFold\n${long}\n\`\`\`\n`);
		expect(open).not.toContain("data-folds");
		expect(open).not.toContain("data-wrap");
	});

	it("reads wrap and noFold from a fence's info line", () => {
		expect(parseCodeFenceMeta('ts title="app.ts" wrap noFold')).toEqual({ title: "app.ts", showLineNumbers: false, wrap: true, fold: false });
		expect(parseCodeFenceMeta("ts")).toEqual({ title: null, showLineNumbers: false, wrap: false, fold: true });
	});

	it("opens with no script: the checked box lifts the height limit and swaps the words", () => {
		expect(MARKDOWN_CSS).toContain(".np-code[data-folds]:has(.np-code-fold-input:checked) .np-code-pre { max-height: none;");
		expect(MARKDOWN_CSS).toContain(".np-code:has(.np-code-fold-input:checked) .np-code-fold-less { display: inline; }");
	});
});

describe("diff code", () => {
	it("marks added and removed lines so the whole line can be tinted", () => {
		const html = renderToString(<CodeView code={"@@ -1 +1 @@\n-old line\n+new line\n same"} language="diff" />);
		expect(html).toContain('<span class="kirari-deleted">-old line</span>');
		expect(html).toContain('<span class="kirari-inserted">+new line</span>');
		expect(MARKDOWN_CSS).toContain(".np-code .kirari-line:has(> .kirari-inserted)");
		expect(MARKDOWN_CSS).toContain(".np-code .kirari-line:has(> .kirari-deleted)");
	});
});
