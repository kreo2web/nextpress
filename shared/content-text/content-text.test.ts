import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { blocksToMarkdown, extractPageText } from "./index.js";

const block = ({ id, name, data, kind = "structured", children }: { id: string; name: string; data: Record<string, string | number | boolean | object>; kind?: "structured" | "text"; children?: BlockConfig[] }): BlockConfig =>
	({
		id,
		name,
		type: children ? "container" : "block",
		parentId: null,
		content: kind === "text" ? { kind: "text", ...data } : { kind: "structured", data },
		...(children ? { children } : {}),
	}) as BlockConfig;

const heading = (id: string, value: string, level = 2): BlockConfig => block({ id, name: "core/heading", data: { value, level }, kind: "text" });
const paragraph = (id: string, value: string): BlockConfig => block({ id, name: "core/paragraph", data: { value }, kind: "text" });

const cell = (content: string, tag: "td" | "th" = "td") => ({ content, tag });

const page: BlockConfig[] = [
	heading("h1", "Getting started", 1),
	paragraph("p1", "Install <strong>NextPress</strong> with <a href=\"/install\">the guide</a> &amp; go."),
	heading("h2", "Install"),
	block({ id: "l", name: "core/list", data: { ordered: true, values: "<li>Download</li><li>Run <code>bun dev</code></li>" } }),
	block({ id: "c", name: "core/code", data: { content: "bun install", language: "bash", title: "terminal" } }),
	block({ id: "m", name: "core/markdown", data: { content: "## Configure\n\nSet the **port**.\n\n```ts\nconst port = 3000\n```", mdx: false } }),
	block({
		id: "t",
		name: "core/table",
		data: { head: [{ cells: [cell("Name", "td"), cell("Type")] }], body: [{ cells: [cell("port"), cell("number")] }], caption: "Options" },
	}),
	block({ id: "q", name: "core/quote", data: { value: "<p>Simple wins</p>", citation: "Ada" } }),
	block({ id: "i", name: "core/image", data: { url: "/uploads/a.png", alt: "A diagram" } }),
	block({ id: "b", name: "core/button", data: { value: "Read more", url: "/docs" }, kind: "text" }),
	block({
		id: "tabs",
		name: "core/tabs",
		data: {},
		children: [block({ id: "tab1", name: "core/tab", data: { title: "npm" }, children: [paragraph("p2", "Use npm.")] })],
	}),
	block({ id: "hid", name: "core/html", data: { content: "<script>alert(1)</script>secret" } }),
];

describe("extractPageText", () => {
	const result = extractPageText(page);

	it("lists headings from heading blocks and markdown blocks with their anchors", () => {
		expect(result.headings).toEqual([
			{ text: "Getting started", id: "getting-started", depth: 1 },
			{ text: "Install", id: "install", depth: 2 },
			{ text: "Configure", id: "configure", depth: 2 },
		]);
	});

	it("reads plain words from text, lists, tables, quotes, code, markdown and tab titles", () => {
		expect(result.text).toContain("Install NextPress with the guide & go.");
		expect(result.text).toContain("Run bun dev");
		expect(result.text).toContain("bun install");
		expect(result.text).toContain("const port = 3000");
		expect(result.text).toContain("port number");
		expect(result.text).toContain("Simple wins");
		expect(result.text).toContain("A diagram");
		expect(result.text).toContain("Read more");
		expect(result.text).toContain("npm");
		expect(result.text).toContain("Use npm.");
	});

	it("leaves out raw HTML blocks and tags", () => {
		expect(result.text).not.toContain("secret");
		expect(result.text).not.toContain("<strong>");
	});

	it("splits the text at headings so a hit can link to its section", () => {
		const configure = result.sections.find((section) => section.id === "configure");
		expect(configure?.text).toContain("Set the port.");
		expect(configure?.text).not.toContain("Run bun dev");
	});

	it("reads MDX blocks and falls back to plain markdown when the MDX is broken", () => {
		const mdx = extractPageText([block({ id: "x", name: "core/markdown", data: { content: "# Hi\n\n<Callout>Careful</Callout>", mdx: true } })]);
		expect(mdx.text).toContain("Careful");
		const broken = extractPageText([block({ id: "y", name: "core/markdown", data: { content: "# Hi\n\n<Callout>Open", mdx: true } })]);
		expect(broken.headings[0]?.text).toBe("Hi");
	});

	it("handles an empty page", () => {
		expect(extractPageText([])).toEqual({ headings: [], text: "", sections: [] });
	});
});

describe("blocksToMarkdown", () => {
	const markdown = blocksToMarkdown(page);

	it("writes headings, inline formatting and links", () => {
		expect(markdown).toContain("# Getting started");
		expect(markdown).toContain("Install **NextPress** with [the guide](/install) & go.");
	});

	it("writes lists, code fences with the language, tables, images and buttons", () => {
		expect(markdown).toContain("1. Download\n2. Run `bun dev`");
		expect(markdown).toContain("```bash title=\"terminal\"\nbun install\n```");
		expect(markdown).toContain("| Name | Type |\n| --- | --- |\n| port | number |");
		expect(markdown).toContain("![A diagram](/uploads/a.png)");
		expect(markdown).toContain("[Read more](/docs)");
		expect(markdown).toContain("> Simple wins\n> — Ada");
	});

	it("keeps markdown blocks as written and titles tabs", () => {
		expect(markdown).toContain("## Configure\n\nSet the **port**.");
		expect(markdown).toContain("**npm**\n\nUse npm.");
	});

	it("skips raw HTML and uses a longer fence around code that has backticks", () => {
		expect(markdown).not.toContain("secret");
		const nested = blocksToMarkdown([block({ id: "z", name: "core/code", data: { content: "```js\nx\n```", language: "md" } })]);
		expect(nested.startsWith("````md")).toBe(true);
	});

	it("is empty for an empty page", () => {
		expect(blocksToMarkdown([])).toBe("");
	});
});
