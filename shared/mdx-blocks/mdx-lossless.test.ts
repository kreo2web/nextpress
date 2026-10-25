import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { blocksToMdx, mdxToBlocks } from "./index.js";

const idMaker = (): (() => string) => {
	let count = 0;
	return () => `b${++count}`;
};

const convert = (text: string) => mdxToBlocks({ text, newId: idMaker() });

const toBlocks = (text: string): BlockConfig[] => {
	const result = convert(text);
	if (!result.ok) throw new Error(result.message);
	return result.blocks;
};

/** The words of every markdown block on a page, in order: what the page kept as written. */
const keptWords = (blocks: BlockConfig[]): string[] =>
	blocks.flatMap((block) => {
		if (block.name === "core/markdown" && block.content?.kind === "structured") return [String(block.content.data.content)];
		return (block.children ?? []).flatMap((child) => keptWords([child]));
	});

describe("what no docs block holds stays word for word", () => {
	it("keeps an unknown tag, a ##### heading and a paragraph with <Kbd> as written", () => {
		const text = [
			"Intro paragraph.",
			"",
			'<Widget id="x">',
			"Custom content",
			"</Widget>",
			"",
			"##### Small heading",
			"",
			"Press <Kbd>K</Kbd> to search.",
			"",
			"End.",
			"",
		].join("\n");
		const blocks = toBlocks(text);
		expect(blocks.map((block) => block.name)).toEqual(["docs/text", "core/markdown", "docs/text"]);
		expect(keptWords(blocks)).toEqual(['<Widget id="x">\nCustom content\n</Widget>\n\n##### Small heading\n\nPress <Kbd>K</Kbd> to search.']);
		expect(blocksToMdx(blocks).mdx).toBe(text);
	});

	it("keeps a callout with a type no callout has, as written", () => {
		const text = '<Callout type="info">\n\nBad type.\n\n</Callout>\n';
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
		expect(blocksToMdx(toBlocks(text)).mdx).toBe(text);
	});

	it("keeps a tab that is not inside tabs, and a card that is not inside cards, as written", () => {
		for (const text of ['<Tab title="alone">\n\ntext\n\n</Tab>\n', '<Card title="loose">\n\ntext\n\n</Card>\n']) {
			expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
			expect(blocksToMdx(toBlocks(text)).mdx).toBe(text);
		}
	});

	it("keeps tabs holding something other than a tab as written", () => {
		const text = "<Tabs>\n\nNo tab here\n\n</Tabs>\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("keeps cards with a column count the grid cannot take", () => {
		const text = '<Cards cols="9">\n\n<Card title="a">\n\nx\n\n</Card>\n\n</Cards>\n';
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("keeps an accordion without a title as written", () => {
		const text = "<Accordion>\n\nNo title\n\n</Accordion>\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("never saves a link that runs code: an unsafe card link keeps the card as written, with no card block", () => {
		const text = '<Cards>\n\n<Card href="javascript:alert(1)" title="t">\n\nx\n\n</Card>\n\n</Cards>\n';
		const blocks = toBlocks(text);
		expect(blocks.map((block) => block.name)).toEqual(["core/markdown"]);
		expect(blocks.some((block) => block.name === "core/card")).toBe(false);
		expect(blocksToMdx(blocks).mdx).toBe(text);
	});

	it("keeps an image with an unsafe address as written", () => {
		const text = "![x](javascript:alert(1))\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("keeps a fence whose info line has a word the code block cannot hold", () => {
		const text = "```ts title=\"a\" extra\ncode\n```\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
		expect(blocksToMdx(toBlocks(text)).mdx).toBe(text);
	});

	it("keeps a diagram fence with line marks as written", () => {
		const text = "```mermaid {2}\nflowchart LR\n```\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("keeps a parameter whose prop is an expression as written", () => {
		const text = '<Param name="a" type={`x`}>d</Param>\n';
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});

	it("keeps a table with aligned columns, and a quote with emphasis, as written", () => {
		for (const text of ["| a | b |\n| :-- | --: |\n| 1 | 2 |\n", "> A *quoted* line\n"]) {
			expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
			expect(blocksToMdx(toBlocks(text)).mdx).toBe(text);
		}
	});

	it("keeps a table cell with an ampersand as written", () => {
		const text = "| a |\n| --- |\n| x & y |\n";
		expect(toBlocks(text).map((block) => block.name)).toEqual(["core/markdown"]);
	});
});

describe("MDX that does not parse", () => {
	it.each([
		["an unclosed component", "<Callout>Open\n"],
		["an unclosed tab inside tabs", "<Tabs><Tab>\n"],
		["an unclosed update at the end", 'text\n\n<Update label="x">\nno end\n'],
		["an unknown component that never closes", "## Heading\n\n<Foo>\n"],
	])("%s gives { ok: false, message, line } and does not throw", (_name, text) => {
		const result = convert(text);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toEqual(expect.any(String));
		expect(result.message.length).toBeGreaterThan(0);
		expect(result.line === null || typeof result.line === "number").toBe(true);
	});

	it("points at the line where the component is not closed", () => {
		const result = convert("## Heading\n\n<Foo>\n");
		expect(result).toMatchObject({ ok: false, line: 3 });
	});
});

describe("blocks with no MDX form", () => {
	it("leaves a gallery out of the MDX and names it in skipped", () => {
		const gallery: BlockConfig = { id: "g", name: "core/gallery", type: "block", parentId: null, content: { kind: "structured", data: { images: [] } }, styles: {}, settings: {} };
		expect(blocksToMdx([gallery])).toEqual({ mdx: "", skipped: ["core/gallery"] });
	});
});
