import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../types/domain.js";
import { createBlocksBuilder } from "./build-block.js";
import { validateBlockTree } from "./validate-block-tree.js";

const blocks = createBlocksBuilder();

const readData = (block: BlockConfig): Record<string, unknown> =>
	block.content?.kind === "structured" ? block.content.data : {};

describe("blocks.buttons keeps its buttons inside the block, like the editor", () => {
	it("builds a plain block, not a container", () => {
		const row = blocks.buttons();
		expect(row.type).toBe("block");
		expect(readData(row)).toMatchObject({
			layout: "flex-start",
			orientation: "horizontal",
			buttons: [expect.objectContaining({ id: "btn-1", text: "Click Me", url: "#" })],
		});
	});

	it("saves the buttons it is given and numbers the ones without an id", () => {
		const row = blocks.buttons({
			settings: {
				content: {
					layout: "center",
					buttons: [
						{ text: "Start", url: "/start" },
						{ id: "docs", text: "Docs", url: "/docs", linkTarget: "_blank", look: "ghost" },
						{ text: "Pricing", url: "/pricing", size: "sm" },
					],
				},
			},
		});
		const data = readData(row);
		expect(data.layout).toBe("center");
		expect(data.buttons).toEqual([
			{ id: "btn-1", text: "Start", url: "/start" },
			{ id: "docs", text: "Docs", url: "/docs", linkTarget: "_blank", look: "ghost" },
			{ id: "btn-3", text: "Pricing", url: "/pricing", size: "sm" },
		]);
		expect(validateBlockTree([row]).ok).toBe(true);
	});

	it("refuses button blocks placed inside it, as the editor has no such shape", () => {
		const row = blocks.buttons();
		const result = validateBlockTree([
			{ ...row, children: [blocks.button({ text: "Child", url: "/x" })] },
		]);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.issues[0]?.message).toContain("cannot have children");
	});
});

describe("builders save under the field names the editor reads", () => {
	it("puts code, preformatted and markdown text in `content`", () => {
		expect(readData(blocks.code({ value: "let a = 1;" })).content).toBe("let a = 1;");
		expect(readData(blocks.preformatted({ text: "  spaced  " })).content).toBe("  spaced  ");
		expect(readData(blocks.markdown({ value: "## Title" })).content).toBe("## Title");
	});

	it("puts quote and pullquote text in `value`", () => {
		expect(readData(blocks.quote({ text: "Be kind" })).value).toBe("Be kind");
		expect(readData(blocks.pullquote({ text: "Stand out" })).value).toBe("Stand out");
	});

	it("puts media-and-text copy in `content`, keeping the media settings", () => {
		const data = readData(
			blocks.mediaText({ settings: { content: { text: "Side copy", mediaPosition: "right" } } }),
		);
		expect(data.content).toBe("Side copy");
		expect(data.mediaPosition).toBe("right");
	});

	it("puts a file's link and name in `href` and `fileName`", () => {
		const data = readData(
			blocks.file({ settings: { content: { url: "/files/a.pdf", filename: "a.pdf" } } }),
		);
		expect(data).toMatchObject({ href: "/files/a.pdf", fileName: "a.pdf" });
	});

	it("puts a separator's line style in `lineStyle`", () => {
		expect(
			readData(blocks.separator({ settings: { content: { style: "dashed" } } })).lineStyle,
		).toBe("dashed");
	});

	it("keeps a field the caller already named the editor's way", () => {
		const code = blocks.fromName("core/code", {
			settings: { content: { content: "saved name", value: "builder name" } },
		});
		expect(readData(code).content).toBe("saved name");
	});

	it("saves a list as one string of list items, with unsafe markup removed", () => {
		const data = readData(
			blocks.list({
				settings: { content: { ordered: true, items: ["One", '<b onclick="x">Two</b>'] } },
			}),
		);
		expect(data.ordered).toBe(true);
		expect(data.values).toBe("<li>One</li><li><b>Two</b></li>");
		expect(data.items).toBeUndefined();
	});

	it("saves a table as header and body rows of cells", () => {
		const data = readData(
			blocks.table({
				settings: {
					content: {
						headers: ["Name", "Role"],
						rows: [
							["Ada", "Engineer"],
							["Grace", "Admiral"],
						],
					},
				},
			}),
		);
		expect(data.head).toEqual([
			{
				cells: [
					{ content: "Name", tag: "th" },
					{ content: "Role", tag: "th" },
				],
			},
		]);
		expect(data.body).toEqual([
			{
				cells: [
					{ content: "Ada", tag: "td" },
					{ content: "Engineer", tag: "td" },
				],
			},
			{
				cells: [
					{ content: "Grace", tag: "td" },
					{ content: "Admiral", tag: "td" },
				],
			},
		]);
		expect(data.headers).toBeUndefined();
		expect(data.rows).toBeUndefined();
	});

	it("keeps the table's other settings when no rows are given", () => {
		const data = readData(blocks.table());
		expect(Array.isArray(data.head)).toBe(true);
		expect(Array.isArray(data.body)).toBe(true);
	});
});

describe("builders lay the caller's values over the editor's defaults", () => {
	it("keeps the sample alt text only with the sample picture", () => {
		const url = "https://cdn.example.com/a.png";
		const sample = blocks.fromName("core/image");
		const own = blocks.image({ url });
		const described = blocks.image({ url, alt: "A cat" });
		expect(sample.content).toMatchObject({ kind: "media", alt: expect.stringMatching(/\S/) });
		expect(own.content).toMatchObject({ kind: "media", url, alt: "" });
		expect(described.content).toMatchObject({ kind: "media", url, alt: "A cat" });
	});

	it("gives video and audio no alt text, only the player settings", () => {
		const video = blocks.video({ url: "https://cdn.example.com/v.mp4" });
		const audio = blocks.audio({ url: "https://cdn.example.com/a.mp3" });
		expect(video.content).toMatchObject({ kind: "media", mediaType: "video", controls: true });
		expect(audio.content).toMatchObject({ kind: "media", mediaType: "audio", controls: true });
		expect(video.content && "alt" in video.content).toBe(false);
		expect(audio.content && "alt" in audio.content).toBe(false);
	});

	it("keeps a post block with no `kind` wrapper plain, with the caller's values on top", () => {
		const toc = blocks.postToc({ settings: { content: { title: "On this page", maxDepth: 2 } } });
		expect(toc.content).toMatchObject({ title: "On this page", maxDepth: 2, ordered: false });
		expect(toc.content && "kind" in toc.content).toBe(false);
		expect(validateBlockTree([toc]).ok).toBe(true);
	});

	it("keeps a heading's anchor and class fields from the editor's default", () => {
		const heading = blocks.heading({ text: "Hi", level: 3 });
		expect(heading.content).toMatchObject({
			kind: "text",
			value: "Hi",
			level: 3,
			anchor: "",
			className: "",
		});
	});

	it("lets styles the caller sets win over the block's defaults and the base spacing", () => {
		const heading = blocks.heading({
			text: "Hi",
			settings: { styles: { margin: "8px", padding: "4px" } },
		});
		expect(heading.styles).toMatchObject({ margin: "8px", padding: "4px" });
	});
});
