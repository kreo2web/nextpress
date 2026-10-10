import { describe, expect, it } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { replaceBlockDeep } from "@/lib/handlers/replace-block-deep";
import { appendBlockToPageShell } from "@/lib/handlers/append-block-to-page-shell";

const text = (id: string, value: string, parentId: string | null = null): BlockConfig => ({
	id,
	name: "core/paragraph",
	type: "block",
	parentId,
	content: { kind: "text", value },
});

const group = (id: string, children: BlockConfig[]): BlockConfig => ({
	id,
	name: "core/group",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: {} },
	children: children.map((child) => ({ ...child, parentId: id })),
});

const shell = (id: string, children: BlockConfig[]): BlockConfig => ({
	id,
	name: "core/page-shell",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: {} },
	children: children.map((child) => ({ ...child, parentId: id })),
});

describe("replaceBlockDeep", () => {
	it("swaps a block for several blocks in the same place, at any depth", () => {
		const tree = [shell("s", [text("a", "A"), group("g", [text("inner", "Inner")]), text("c", "C")])];
		const next = replaceBlockDeep(tree, "inner", [text("x", "X1", "g"), text("y", "X2", "g")]);

		const innerGroup = next[0].children?.[1];
		expect(innerGroup?.children?.map((block) => block.id)).toEqual(["x", "y"]);
		expect(next[0].children?.map((block) => block.id)).toEqual(["a", "g", "c"]);
	});

	it("returns the same array when the block is not in the tree", () => {
		const tree = [text("a", "A")];
		expect(replaceBlockDeep(tree, "missing", [text("x", "X")])).toBe(tree);
	});

	it("does not change the array it was given", () => {
		const tree = [shell("s", [text("a", "A")])];
		replaceBlockDeep(tree, "a", []);
		expect(tree[0].children?.map((block) => block.id)).toEqual(["a"]);
	});
});

describe("appendBlockToPageShell", () => {
	it("adds the block as the last child of the page shell", () => {
		const page = [shell("s", [text("a", "A")])];
		const next = appendBlockToPageShell(page, text("part", "Part"));

		expect(next).toHaveLength(1);
		expect(next[0].children?.map((block) => block.id)).toEqual(["a", "part"]);
		expect(next[0].children?.[1].parentId).toBe("s");
	});

	it("adds to the end of the root when the page has no shell", () => {
		const next = appendBlockToPageShell([text("a", "A")], text("part", "Part"));
		expect(next.map((block) => block.id)).toEqual(["a", "part"]);
		expect(next[1].parentId).toBeNull();
	});
});
