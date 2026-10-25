import { describe, expect, it } from "vitest";
import { getBlockEntry } from "../block-catalog/entries.js";
import { docsHeadingId } from "../blocks/docs-heading-id.js";
import { readDocsHeadingContent } from "../blocks/docs-heading-model.js";
import { readDocsListContent } from "../blocks/docs-list-model.js";
import { readDocsTextContent } from "../blocks/docs-text-model.js";
import { createSlugger, readMarkdownHeadings } from "../markdown/headings.js";
import { parseMarkdown } from "../markdown/parse-markdown.js";
import { collectHeadingsFromBlocks } from "../page-headings.js";
import type { BlockConfig } from "../schema-types.js";
import { blocksToMdx, mdxToBlocks } from "./index.js";

const idMaker = (): (() => string) => {
	let count = 0;
	return () => `b${++count}`;
};

const toBlocks = (text: string): BlockConfig[] => {
	const result = mdxToBlocks({ text, newId: idMaker() });
	if (!result.ok) throw new Error(result.message);
	return result.blocks;
};

/** A block with its random-looking parts (ids) removed, so two trees compare by what they hold. */
const shape = (blocks: BlockConfig[]) => blocks.map((block) => ({ name: block.name, content: block.content }));

describe("docs heading ids", () => {
	it.each(["Install the CLI", "What's new?", "Café menu", "Use `useState` hooks", "Step 1: Set up", "   "])(
		"matches the contents list for %j",
		(text) => {
			const tree = parseMarkdown({ text: `## ${text.trim() || "x"}` });
			if (!tree.ok) throw new Error("parse");
			const fromList = readMarkdownHeadings(tree.tree, createSlugger())[0].id;
			if (text.trim()) expect(docsHeadingId(text)).toBe(fromList);
			else expect(docsHeadingId(text)).toBe("section");
		},
	);

	it("is the id the page's contents list (collectHeadingsFromBlocks) gives a docs heading block", () => {
		const [block] = toBlocks("### Install the **CLI**");
		expect(collectHeadingsFromBlocks([block])).toEqual([{ id: "install-the-cli", text: "Install the CLI", level: 3 }]);
	});
});

describe("docs heading anchor override", () => {
	it("uses the author's link id (made safe) in the block and in the contents list", () => {
		const block = { ...toBlocks("## Install")[0], content: { kind: "structured" as const, data: { level: 2, text: "Install", anchor: "Get Going" } } };
		expect(collectHeadingsFromBlocks([block])[0].id).toBe("get-going");
	});
});

describe("MDX in, blocks", () => {
	const page = "## Getting started\n\nUse **bold**, *italic*, `code` and [a link](https://example.com/a).\n\n- one\n- two\n  - nested\n";

	it("makes a heading, a paragraph and a list", () => {
		const blocks = toBlocks(page);
		expect(blocks.map((block) => block.name)).toEqual(["docs/heading", "docs/text", "docs/list"]);
		expect(readDocsHeadingContent(blocks[0].content)).toEqual({ level: 2, text: "Getting started", anchor: "" });
		expect(readDocsTextContent(blocks[1].content).text).toBe("Use **bold**, *italic*, `code` and [a link](https://example.com/a).");
		expect(readDocsListContent(blocks[2].content).items[1].children).toEqual([{ text: "nested", checked: false }]);
	});

	it("exports to MDX that parses back to the same tree", () => {
		const first = toBlocks(page);
		const { mdx, skipped } = blocksToMdx(first);
		expect(skipped).toEqual([]);
		expect(mdx).toBe(page);
		expect(shape(toBlocks(mdx))).toEqual(shape(first));
	});

	it("gives every block the catalog's docs category", () => {
		toBlocks(page).forEach((block) => expect(getBlockEntry(block.name as "docs/text").category).toBe("docs"));
	});

	it("keeps what no docs block holds as one MDX markdown block, and exports it unchanged", () => {
		const text = "Intro\n\n<Widget id=\"x\">\nCustom\n</Widget>\n\n##### Small\n\nEnd\n";
		const blocks = toBlocks(text);
		expect(blocks.map((block) => block.name)).toEqual(["docs/text", "core/markdown", "docs/text"]);
		expect(blocksToMdx(blocks).mdx).toBe(text);
		expect(shape(toBlocks(blocksToMdx(blocks).mdx))).toEqual(shape(blocks));
	});

	it("reports MDX that does not parse instead of throwing", () => {
		const result = mdxToBlocks({ text: "<Callout>Open", newId: idMaker() });
		expect(result.ok).toBe(false);
	});
});

describe("text round trip", () => {
	it.each([
		"Plain words.",
		"**Bold** and *italic* and `code`.",
		"A [link](/docs/start) in the middle, and [another](https://example.com).",
		"Nested **bold with *italic* inside** here.",
		"Two lines\nin one paragraph.",
		"Set {name} here.",
	])("keeps %j identical", (text) => {
		const first = toBlocks(text);
		expect(first.map((block) => block.name)).toEqual(["docs/text"]);
		const out = blocksToMdx(first).mdx;
		expect(shape(toBlocks(out))).toEqual(shape(first));
		expect(blocksToMdx(toBlocks(out)).mdx).toBe(out);
		expect(out.trim()).toBe(text.replace("{name}", "\\{name\\}"));
	});

	it("never turns typed text into a list when exported", () => {
		const block = { ...toBlocks("x")[0], content: { kind: "structured" as const, data: { text: "- not a list" } } };
		const out = blocksToMdx([block]).mdx;
		expect(toBlocks(out).map((item) => item.name)).toEqual(["docs/text"]);
	});
});

describe("list round trip", () => {
	it.each([
		["bullets", "- one\n- two\n  - nested a\n  - nested b\n- three\n", "bullet"],
		["numbers", "1. one\n2. two\n   1. nested\n3. three\n", "number"],
		["checklist", "- [ ] open\n- [x] done\n  - [x] sub done\n  - [ ] sub open\n", "check"],
	])("%s in both directions", (_name, mdx, style) => {
		const blocks = toBlocks(mdx);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("docs/list");
		expect(readDocsListContent(blocks[0].content).style).toBe(style);
		expect(blocksToMdx(blocks).mdx).toBe(mdx);
	});

	it("reads checked boxes and nested items from MDX", () => {
		const { items } = readDocsListContent(toBlocks("- [ ] open\n- [x] done\n  - [x] sub\n")[0].content);
		expect(items.map((item) => item.checked)).toEqual([false, true]);
		expect(items[1].children).toEqual([{ text: "sub", checked: true }]);
	});

	it("keeps a list it cannot hold (three levels, mixed boxes) as markdown", () => {
		for (const text of ["- a\n  - b\n    - c\n", "- [ ] a\n- b\n", "3. a\n4. b\n"]) {
			const blocks = toBlocks(text);
			expect(blocks.map((block) => block.name)).toEqual(["core/markdown"]);
			expect(blocksToMdx(blocks).mdx).toBe(text);
		}
	});
});
