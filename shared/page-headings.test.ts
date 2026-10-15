import { describe, expect, it } from "vitest";
import type { BlockConfig } from "./schema-types";
import {
	collectHeadingsFromBlocks,
	headingAnchorId,
	readBoundHeadings,
} from "./page-headings";

const heading = (value: string, level = 2, anchor?: string): BlockConfig =>
	({
		id: value,
		name: "core/heading",
		type: "block",
		parentId: null,
		content: { kind: "text", value, level, ...(anchor ? { anchor } : {}) },
	}) as BlockConfig;

describe("headingAnchorId", () => {
	it("uses a saved anchor, otherwise slugs the words", () => {
		expect(headingAnchorId({ text: "Hello World", anchor: "custom" })).toBe("custom");
		expect(headingAnchorId({ text: "Hello World" })).toBe("hello-world");
	});
});

describe("collectHeadingsFromBlocks", () => {
	it("walks nested headings and post titles in tree order", () => {
		const entries = collectHeadingsFromBlocks(
			[
				heading("Intro", 2),
				{
					id: "cols",
					name: "core/columns",
					type: "container",
					parentId: null,
					children: [
						heading("Nested", 3, "nested-id"),
						{
							id: "title",
							name: "post/title",
							type: "block",
							parentId: "cols",
							content: { kind: "structured", data: { text: "First Post", tag: "h1" } },
						} as BlockConfig,
					],
				} as BlockConfig,
			],
			3,
		);
		expect(entries).toEqual([
			{ id: "intro", text: "Intro", level: 2 },
			{ id: "nested-id", text: "Nested", level: 3 },
			{ id: "first-post", text: "First Post", level: 1 },
		]);
	});
});

describe("readBoundHeadings", () => {
	it("keeps only entries with text", () => {
		expect(
			readBoundHeadings([
				{ id: "a", text: "A", level: 2 },
				{ text: "  " },
				{ text: "B" },
			]),
		).toEqual([
			{ id: "a", text: "A", level: 2 },
			{ id: "b", text: "B", level: 2 },
		]);
	});
});
