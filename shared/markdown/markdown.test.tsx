import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeView } from "./code-view.js";
import { parseCodeFenceMeta, parseLineList } from "./code-meta.js";
import { DOC_COMPONENT_PROPS } from "./doc-components.js";
import { createSlugger, readMarkdownHeadings } from "./headings.js";
import { highlightCode } from "./highlight.js";
import { MARKED_LINE_CLASS } from "./kirari-options.js";
import { MarkdownView } from "./markdown-view.js";
import { escapeMdxBraces } from "./mdx-text.js";
import { parseMarkdown } from "./parse-markdown.js";
import { markdownToPlainText } from "./plain-text.js";

const render = (markdown: string, options: { mdx?: boolean; renderDiagram?: (source: string) => string } = {}): string =>
	renderToString(<MarkdownView text={markdown} mdx={options.mdx} renderDiagram={options.renderDiagram} />);

describe("code fence options", () => {
	it("reads line lists and ranges, skipping what isn't one", () => {
		expect([...parseLineList("2, 4-6, x, 9-8, 0")]).toEqual([2, 4, 5, 6]);
		expect(parseLineList(undefined).size).toBe(0);
	});

	it("reads the title and line numbers from the info line (the {1,3} lines are Kirari's plugin's job)", () => {
		const meta = parseCodeFenceMeta('{1,3} title="src/app.ts" showLineNumbers');
		expect(meta).toEqual({ title: "src/app.ts", showLineNumbers: true, wrap: false, fold: true });
		expect(parseCodeFenceMeta("filename=index.js").title).toBe("index.js");
		expect(parseCodeFenceMeta(null)).toEqual({ title: null, showLineNumbers: false, wrap: false, fold: true });
	});
});

describe("highlightCode", () => {
	it("colors known languages through aliases and marks lines", () => {
		const { html, language } = highlightCode({ code: "const a = 1\nlet b = 2", language: "ts", highlightLines: new Set([2]) });
		expect(language).toBe("typescript");
		expect(html).toContain('<span class="kirari-keyword">const</span>');
		expect(html).toMatch(new RegExp(`data-line="2"[^>]*class="[^"]*${MARKED_LINE_CLASS}|class="[^"]*${MARKED_LINE_CLASS}[^"]*"[^>]*data-line="2"`));
	});

	it("shows an unknown language as plain text in the same line structure, escaped", () => {
		const { html, language } = highlightCode({ code: "<script>alert(1)</script>", language: "klingon" });
		expect(language).toBeNull();
		expect(html).toContain("kirari-line");
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});

describe("parseMarkdown", () => {
	it("makes MDX safe: imports dropped, braces kept as text, unknown tags unwrapped, only allowed literal props", () => {
		const parsed = parseMarkdown({
			text: 'import x from "y"\n\n<Callout type="tip" onClick={run} title="Hi">Body {name}</Callout>\n\n<Unknown>kept</Unknown>\n',
			mdx: true,
			components: DOC_COMPONENT_PROPS,
		});
		if (!parsed.ok) throw new Error(parsed.message);
		const json = JSON.stringify(parsed.tree);
		expect(json).not.toContain("mdxjsEsm");
		expect(json).toContain('"hProperties":{"type":"tip","title":"Hi"}');
		expect(json).toContain('"value":"Body {name}"');
		expect(json).not.toContain("Unknown");
		expect(json).toContain('"value":"kept"');
	});

	it("says what is wrong, and where, when MDX doesn't parse, instead of throwing", () => {
		const parsed = parseMarkdown({ text: "text\n\n<Callout>\nnever closed\n", mdx: true });
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.message).toBe("Expected a closing tag for `<Callout>`");
		expect(parsed.line).toBe(3);
	});
});

describe("escapeMdxBraces", () => {
	it("escapes braces in prose but not in code, existing escapes or component tags", () => {
		expect(escapeMdxBraces("Set {name} here")).toBe("Set \\{name\\} here");
		expect(escapeMdxBraces("Use `{x}` and \\{y}")).toBe("Use `{x}` and \\{y\\}");
		expect(escapeMdxBraces('<Tab title="a{b}" n={1}>\n{c}\n</Tab>')).toBe('<Tab title="a{b}" n={1}>\n\\{c\\}\n</Tab>');
		expect(escapeMdxBraces("```js\nconst o = {}\n```\n{after}")).toBe("```js\nconst o = {}\n```\n\\{after\\}");
		expect(escapeMdxBraces("a < b {c}")).toBe("a < b \\{c\\}");
	});

	it("lets prose with braces parse as MDX and show the braces as written", () => {
		const parsed = parseMarkdown({ text: '<Callout type="note">\nSet {not valid js} here.\n</Callout>\n', mdx: true, components: DOC_COMPONENT_PROPS });
		expect(parsed.ok).toBe(true);
		const html = render('<Callout type="note">\nSet {not valid js} here.\n</Callout>\n', { mdx: true });
		expect(html).toContain("np-callout");
		expect(html).toContain("Set {not valid js} here.");
	});
});

describe("headings and plain text", () => {
	it("gives repeated headings their own anchors, the same way every time", () => {
		const slug = createSlugger();
		expect([slug("Install"), slug("Install"), slug("Héllo, wörld!"), slug("!!!")]).toEqual(["install", "install-1", "héllo-wörld", "section"]);
	});

	it("reads headings with anchors and the page text for search", () => {
		const parsed = parseMarkdown({ text: "# Start here\n\nSome *words*.\n\n## Start here\n\n```js\nrun()\n```\n\n- one\n- two\n" });
		if (!parsed.ok) throw new Error(parsed.message);
		expect(readMarkdownHeadings(parsed.tree)).toEqual([
			{ depth: 1, text: "Start here", id: "start-here" },
			{ depth: 2, text: "Start here", id: "start-here-1" },
		]);
		expect(markdownToPlainText(parsed.tree)).toBe("Start here\nSome words.\nStart here\nrun()\none\ntwo");
	});
});

describe("MarkdownView on the server", () => {
	it("anchors headings exactly as the heading reader does", () => {
		const html = render("# Intro\n\n## Intro\n");
		expect(html).toContain('<h1 id="intro">Intro</h1>');
		expect(html).toContain('<h2 id="intro-1">Intro</h2>');
	});

	it("colors fenced code with its title and marked lines, already in the HTML", () => {
		const html = render('```ts {2} title="app.ts"\nconst a = 1\nconst b = 2\n```\n');
		expect(html).toContain('class="np-code-title">app.ts');
		expect(html).toContain("kirari-keyword");
		expect(html).toContain(MARKED_LINE_CLASS);
		expect(html).toContain("data-np-copy");
	});

	it("draws Mermaid on the server when given a renderer, and explains a broken one", () => {
		expect(render("```mermaid\ngraph LR\nA-->B\n```\n", { renderDiagram: () => "<svg data-test></svg>" })).toContain("<svg data-test>");
		const broken = render("```mermaid\nnope\n```\n", {
			renderDiagram: () => {
				throw new Error("Unknown diagram type");
			},
		});
		expect(broken).toContain("This diagram couldn&#x27;t be drawn. Check the text below for a typo or a missing arrow.");
		expect(broken).not.toContain("Unknown diagram type");
		expect(broken).toContain("<pre>nope</pre>");
	});

	it("renders allowed MDX components with markdown inside, and falls back to plain markdown when MDX is broken", () => {
		const html = render('<Callout type="warning" title="Careful">\nIt **bites**.\n</Callout>\n', { mdx: true });
		expect(html).toContain('class="np-callout" data-type="warning"');
		expect(html).toContain("Careful");
		expect(html).toContain("<strong>bites</strong>");
		expect(() => render("<Callout>\nnever closed\n", { mdx: true })).not.toThrow();
	});

	it("strips scripts and event handlers, wraps tables, and marks outside links", () => {
		const html = render('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n| a |\n|---|\n| 1 |\n\n[out](https://example.com) [in](/docs)\n');
		expect(html).not.toContain("<script");
		expect(html).not.toContain("onerror");
		expect(html).toContain('<div class="np-table"><table>');
		expect(html).toContain('href="https://example.com/" target="_blank" rel="noopener noreferrer"');
		expect(html).toContain('<a href="/docs">in</a>');
	});
});

describe("CodeView", () => {
	it("shows the title, the language and a copy button, and skips the header when there is nothing to show", () => {
		const full = renderToString(<CodeView code="x" language="py" title="main.py" showLineNumbers wrapLines />);
		expect(full).toContain("main.py");
		expect(full).toContain(">Python<");
		expect(full).toContain("data-line-numbers");
		expect(full).toContain("data-wrap");
		const bare = renderToString(<CodeView code="x" showCopyButton={false} />);
		expect(bare).not.toContain("np-code-header");
	});
});

describe("MDX props that are literal expressions", () => {
	const propsOf = (tag: string): Record<string, string> => {
		const parsed = parseMarkdown({ text: tag, mdx: true, components: DOC_COMPONENT_PROPS });
		if (!parsed.ok) throw new Error(parsed.message);
		const match = /"hProperties":(\{[^}]*\})/.exec(JSON.stringify(parsed.tree));
		return match ? (JSON.parse(match[1]) as Record<string, string>) : {};
	};

	it("keeps a single number, true or string literal as text", () => {
		expect(propsOf("<Cards cols={2}>x</Cards>")).toEqual({ cols: "2" });
		expect(propsOf('<Param name={"id"} required={true}>x</Param>')).toEqual({ name: "id", required: "true" });
		expect(propsOf("<Callout title={'Hi there'}>x</Callout>")).toEqual({ title: "Hi there" });
		expect(propsOf("<Param name='a' required>x</Param>")).toEqual({ name: "a", required: "true" });
	});

	it("drops {false} and every expression that isn't one literal", () => {
		expect(propsOf("<Param name='a' required={false}>x</Param>")).toEqual({ name: "a" });
		expect(propsOf("<Callout title={name}>x</Callout>")).toEqual({});
		expect(propsOf("<Callout title={`Hi ${name}`}>x</Callout>")).toEqual({});
		expect(propsOf("<Callout title={run()}>x</Callout>")).toEqual({});
		expect(propsOf("<Callout title={{ a: 1 }}>x</Callout>")).toEqual({});
		expect(propsOf("<Cards cols={1 + 1}>x</Cards>")).toEqual({});
		expect(propsOf("<Cards cols={null}>x</Cards>")).toEqual({});
		expect(propsOf("<Callout title={'a'} title2={'b'}>x</Callout>")).toEqual({ title: "a" });
	});

	it("still drops event handlers and props the component doesn't list, even with literal values", () => {
		expect(propsOf('<Callout onClick={"alert(1)"} style={"color:red"} dangerouslySetInnerHTML={"x"} type="tip">x</Callout>')).toEqual({ type: "tip" });
	});

	it("shows a literal prop on the page", () => {
		const html = render("<Callout type={'danger'} title={\"Heads up\"}>Body</Callout>", { mdx: true });
		expect(html).toContain('data-type="danger"');
		expect(html).toContain("Heads up");
	});

	it("never runs an expression", () => {
		const html = render("<Callout title={globalThis.leak = 1}>Body</Callout>", { mdx: true });
		expect(html).not.toContain("np-callout-title");
	});
});
