import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeView } from "./code-view.js";
import { MarkdownView } from "./markdown-view.js";

const fence = (text: string): string => renderToString(<MarkdownView text={text} />);

/** The colored code inside the frame: what a fence and a code block must agree on. */
const innerCode = (html: string): string => /<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/.exec(html)?.[1] ?? "";
/** Same markup apart from spellings that mean the same: quote entities, and the empty comment React puts between two text pieces. */
const sameQuotes = (html: string): string => html.replace(/&#x27;|&#39;/g, "'").replace(/<!-- -->/g, "");
const textOf = (html: string): string => html.replace(/<[^>]*>/g, "");

const SAMPLE = 'const a = "x" + 1 < 2\nlet b = `t ${a}`\n\n// done\nexport type T = { id: string }';

describe("a fence and a core/code block", () => {
	it("give identical colored markup for the same code", () => {
		for (const [typed, code] of [["ts", SAMPLE], ["python", 'def f(x):\n    return "a" + x  # c'], ["css", ".a { color: red; }\n.b:hover { margin: 0 }"], ["bash", "npm i\necho $HOME # hi"]] as const) {
			const fromFence = innerCode(fence(`\`\`\`${typed}\n${code}\n\`\`\`\n`));
			const fromBlock = innerCode(renderToString(<CodeView code={code} language={typed} />));
			expect(fromFence).not.toBe("");
			expect(sameQuotes(fromFence)).toBe(sameQuotes(fromBlock));
		}
	});

	it("also agree with marked lines", () => {
		const fromFence = innerCode(fence(`\`\`\`ts {2,4-5}\n${SAMPLE}\n\`\`\`\n`));
		const fromBlock = innerCode(renderToString(<CodeView code={SAMPLE} language="ts" highlightLines={new Set([2, 4, 5])} />));
		expect(sameQuotes(fromFence)).toBe(sameQuotes(fromBlock));
	});
});

describe("fence options", () => {
	const lineClasses = (html: string): Record<string, boolean> =>
		Object.fromEntries([...html.matchAll(/class="kirari-line([^"]*)" data-line="(\d+)"/g)].map((m) => [m[2], m[1].includes("kirari-line-highlighted")]));

	it("marks lines 2, 4, 5 and 6 from {2,4-6}, and no others", () => {
		const code = "a\nb\nc\nd\ne\nf\ng";
		expect(lineClasses(fence(`\`\`\`ts {2,4-6}\n${code}\n\`\`\`\n`))).toEqual({ 1: false, 2: true, 3: false, 4: true, 5: true, 6: true, 7: false });
	});

	it("numbers lines with showLineNumbers, shows the title, and has a copy button", () => {
		const html = fence('```ts title="app.ts" showLineNumbers\nconst a = 1\n```\n');
		expect(html).toContain('data-line-numbers=""');
		expect(html).toContain('class="np-code-title">app.ts');
		expect(html).toContain("data-np-copy");
		expect(fence("```ts\nconst a = 1\n```\n")).not.toContain("data-line-numbers");
	});

	it("shows an unknown language, or none, as plain lines in the same frame", () => {
		for (const text of ["```klingon\nplain <b>\nline 2\n```\n", "```\nplain <b>\nline 2\n```\n"]) {
			const html = fence(text);
			expect(html).toContain("np-code-copy");
			expect(html).toContain('<span class="kirari-line" data-line="1">plain &lt;b&gt;</span>');
			expect(html).toContain('data-line="2">line 2<');
			expect(html).not.toContain("kirari-keyword");
		}
	});

	it("leaves inline code and mermaid alone", () => {
		expect(fence("use `const x = 1` here")).toContain('<code class="np-inline-code">const x = 1</code>');
		const diagram = renderToString(<MarkdownView text={"```mermaid\ngraph LR\nA-->B\n```\n"} renderDiagram={() => "<svg data-d></svg>"} />);
		expect(diagram).toContain("<svg data-d>");
		expect(diagram).not.toContain("np-code");
		expect(diagram).not.toContain("kirari-line");
	});

	it("still shows code while a reply is streaming", () => {
		const html = renderToString(<MarkdownView mode="streaming" text={"Here:\n\n```ts\nconst a = 1\nlet b"} />);
		expect(html).toContain("kirari-keyword");
		expect(html).toContain("np-code");
	});
});

describe("the sanitizer around fences", () => {
	it("strips scripts and handlers in the page while keeping hostile fence text as inert text", () => {
		const html = fence(
			'<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n<a href="javascript:alert(3)" onclick="alert(4)">x</a>\n\n' +
				'```html\n<script>alert(5)</script>\n<img src=x onerror=alert(6)>\n```\n\n' +
				'```ts\nconst s = "</code></pre><script>alert(7)</script>"\n```\n\n<div onmouseover="alert(8)">after</div>\n',
		);
		expect(html).not.toMatch(/<script/i);
		expect(html).not.toMatch(/\son(error|click|mouseover)=/i);
		expect(html).not.toContain("javascript:");
		expect(textOf(html)).toContain("&lt;script&gt;alert(5)&lt;/script&gt;");
		expect(html).toContain("after");
	});
});
