import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { outlinePage } from "./outline-page.js";
import { makeBlock, makeHeading, makeParagraph, makeSamplePage } from "./test-support/memory-context.js";

describe("outlinePage", () => {
	it("writes one indented line per block with short name, id, label and key content", () => {
		const outline = outlinePage({ blocks: makeSamplePage() });
		expect(outline.split("\n")).toEqual([
			"page-shell id=shell",
			'  stack id=hero label="Hero" stack=vertical',
			'    heading id=title level=1 text="Welcome"',
			'    paragraph id=intro text="Hello there"',
			'  paragraph id=outro text="Bye"',
		]);
	});

	it("marks the selected block", () => {
		const lines = outlinePage({ blocks: makeSamplePage(), focusBlockId: "intro" }).split("\n");
		expect(lines[3]).toBe('    paragraph id=intro text="Hello there" ← selected');
		expect(lines.filter((line) => line.includes("← selected"))).toHaveLength(1);
	});

	it("leaves out the label when it is the catalog label or empty, and keeps post/ names whole", () => {
		const outline = outlinePage({
			blocks: [
				makeBlock({ name: "core/group", id: "same", label: "Group" }),
				makeBlock({ name: "core/group", id: "blank", label: "  " }),
				makeBlock({ name: "post/title", id: "pt" }),
			],
		});
		expect(outline).not.toContain("label=");
		expect(outline).toContain("post/title id=pt");
	});

	it("cuts long text at maxText and strips html tags", () => {
		const long = "word ".repeat(40);
		const outline = outlinePage({
			blocks: [
				makeParagraph({ id: "p", text: long }),
				makeBlock({ name: "core/quote", id: "q", content: { kind: "structured", data: { value: "<p>Be <b>bold</b> &amp; kind</p>" } } }),
			],
			maxText: 20,
		});
		expect(outline).toContain('text="word word word word…"');
		expect(outline).toContain('text="Be bold & kind"');
	});

	it("shows button link, image url and alt, header variant, popup slug and form field name", () => {
		const blocks: BlockConfig[] = [
			makeBlock({ name: "core/button", id: "b", content: { kind: "text", value: "Get started", url: "/signup" } }),
			makeBlock({ name: "core/image", id: "i", content: { kind: "media", mediaType: "image", url: "/media/a.jpg", alt: "A red door" } }),
			makeBlock({ name: "core/header", id: "h" }),
			makeBlock({ name: "core/popup", id: "pop" }),
			makeBlock({ name: "core/input", id: "f", content: { kind: "structured", data: { name: "email", label: "Your email" } } }),
			makeBlock({ name: "core/stack", id: "s", content: { kind: "structured", data: { stackType: "overlay" } } }),
		];
		// A popup starts with a heading inside it; only the top-level lines are checked here.
		const lines = outlinePage({ blocks }).split("\n").filter((line) => !line.startsWith(" "));
		expect(lines[0]).toBe('button id=b text="Get started" url=/signup');
		expect(lines[1]).toBe('image id=i url=/media/a.jpg alt="A red door"');
		expect(lines[2]).toBe("header id=h variant=links-and-actions");
		expect(lines[3]).toBe("popup id=pop slug=popup");
		expect(lines[4]).toBe('input id=f name=email label="Your email"');
		expect(lines[5]).toBe("stack id=s stack=overlay");
	});

	it("shows an empty page plainly", () => {
		expect(outlinePage({ blocks: [] })).toBe("(empty page)");
	});

	it("folds blocks deeper than maxDepth and counts what is inside", () => {
		const outline = outlinePage({ blocks: makeSamplePage(), maxDepth: 1 });
		expect(outline.split("\n")).toEqual([
			"page-shell id=shell",
			'  stack id=hero label="Hero" stack=vertical (+2 inside)',
			'  paragraph id=outro text="Bye"',
		]);
	});

	it("keeps a 150-block page under 18 KB even when every line is full (ids alone are about 5.5 KB)", () => {
		const sections = Array.from({ length: 30 }, (_, section) =>
			makeBlock({
				name: "core/stack",
				id: `00000000-0000-4000-8000-${String(section).padStart(12, "0")}`,
				children: Array.from({ length: 4 }, (_, item) =>
					makeParagraph({
						id: `00000000-0000-4000-9000-${String(section * 10 + item).padStart(12, "0")}`,
						text: `Paragraph number ${item} of section ${section} with some more words in it to fill the line`,
					}),
				),
			}),
		);
		const page = [makeBlock({ name: "core/page-shell", id: "11111111-1111-4111-8111-111111111111", children: sections })];
		const outline = outlinePage({ blocks: page });
		expect(outline.split("\n")).toHaveLength(151);
		expect(outline.length).toBeLessThan(18_000);
		expect(outline.length).toBeGreaterThan(8_000);
	});

	it("makes a heading line and a text-less block readable", () => {
		const outline = outlinePage({ blocks: [makeHeading({ id: "h1", text: "Title", level: 3 }), makeBlock({ name: "core/spacer", id: "sp" })] });
		expect(outline.split("\n")).toEqual(['heading id=h1 level=3 text="Title"', "spacer id=sp"]);
	});

	it("keeps the docs/ prefix on docs blocks and shows what identifies each", () => {
		const blocks: BlockConfig[] = [
			makeBlock({ name: "docs/callout", id: "c", content: { kind: "structured", data: { type: "warning", title: "Back up first" } } }),
			makeBlock({ name: "docs/file-tree", id: "t", content: { kind: "structured", data: { tree: "src/\n  app.ts" } } }),
			makeBlock({ name: "docs/params", id: "p" }),
			makeBlock({ name: "docs/example", id: "e", content: { kind: "structured", data: { layout: "stacked" } } }),
		];
		// A callout and an example start with child blocks; only the top-level lines are checked here.
		const lines = outlinePage({ blocks }).split("\n").filter((line) => !line.startsWith(" "));
		expect(lines).toEqual([
			'docs/callout id=c type=warning title="Back up first"',
			'docs/file-tree id=t text="src/ app.ts"',
			"docs/params id=p items=2",
			"docs/example id=e layout=stacked",
		]);
	});
});
