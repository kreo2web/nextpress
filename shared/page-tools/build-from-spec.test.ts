import { describe, expect, it } from "vitest";
import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import { readColumnLayoutFromBlock } from "../columns-layout.js";
import type { BlockConfig } from "../schema-types.js";
import { buildBlockFromSpec } from "./build-from-spec.js";
import { mergeBlockUpdate } from "./merge-block-update.js";
import { collectBlockIds, countBlocks } from "./tree-find.js";
import { makeBlock } from "./test-support/memory-context.js";

const counter = () => {
	let n = 0;
	return () => `id-${++n}`;
};

const build = (spec: Parameters<typeof buildBlockFromSpec>[0]["spec"], parentId: string | null = "parent") => {
	const result = buildBlockFromSpec({ spec, parentId, newId: counter() });
	if (!result.ok) throw new Error(result.message);
	return result.value;
};

describe("buildBlockFromSpec: content", () => {
	it("lays text content over the defaults, keeping the kind and the other defaults", () => {
		const block = build({ name: "core/heading", content: { value: "Hello", level: 1 } });
		expect(block.content).toMatchObject({ kind: "text", value: "Hello", level: 1, anchor: "", className: "" });
		expect(block.parentId).toBe("parent");
		expect(block.type).toBe("block");
	});

	it("lays media content over the defaults", () => {
		const block = build({ name: "core/image", content: { url: "/media/a.jpg", alt: "A door" } });
		expect(block.content).toMatchObject({ kind: "media", mediaType: "image", url: "/media/a.jpg", alt: "A door", sizeSlug: "full" });
	});

	it("puts content for structured blocks into data, beside the default fields", () => {
		const block = build({ name: "core/stack", content: { stackType: "horizontal" } });
		expect(block.content).toEqual({ kind: "structured", data: { stackType: "horizontal" } });

		const button = build({ name: "core/popup", content: { slug: "pricing", size: "lg" } });
		expect(button.content).toMatchObject({ kind: "structured", data: { name: "Popup", slug: "pricing", size: "lg", closeButton: true } });
	});

	it("shallow-merges content for plain blocks that have no kind", () => {
		const block = build({ name: "post/toc", content: { title: "On this page", maxDepth: 2 } });
		expect(block.content).toEqual({ title: "On this page", maxDepth: 2, ordered: false, sticky: false, className: "" });
	});

	it("removes a default field when its value is null", () => {
		const block = build({ name: "core/popup", content: { backdropBlur: null } });
		const data = (block.content as { data: Record<string, unknown> }).data;
		expect(data).not.toHaveProperty("backdropBlur");
		expect(data.slug).toBe("popup");
	});

	it("refuses a content kind that differs from the block's, and a data wrapper on a structured block", () => {
		const kind = buildBlockFromSpec({ spec: { name: "core/heading", content: { kind: "markdown" } }, parentId: null, newId: counter() });
		expect(kind).toEqual({ ok: false, message: expect.stringContaining("core/heading: content.kind can't be changed") });
		const wrapped = buildBlockFromSpec({ spec: { name: "core/stack", content: { data: { stackType: "overlay" } } }, parentId: null, newId: counter() });
		expect(wrapped.ok).toBe(false);
		const same = buildBlockFromSpec({ spec: { name: "core/heading", content: { kind: "text", value: "ok" } }, parentId: null, newId: counter() });
		expect(same.ok).toBe(true);
	});
});

describe("buildBlockFromSpec: styles, label and ids", () => {
	it("lays styles over the default styles and null removes one", () => {
		const base = createDefaultBlock({ name: "core/stack", id: "x", newId: counter() });
		expect(base?.styles).toHaveProperty("padding");
		const block = build({ name: "core/stack", styles: { gap: "2rem", padding: null, color: "red" } });
		expect(block.styles).toMatchObject({ gap: "2rem", color: "red" });
		expect(block.styles).not.toHaveProperty("padding");
		expect(block.styles).toHaveProperty("margin");
	});

	it("uses the catalog label unless the spec gives one", () => {
		expect(build({ name: "core/group" }).label).toBe("Group");
		expect(build({ name: "core/group", label: "Hero" }).label).toBe("Hero");
	});

	it("takes every id from newId, the block's own, starting children and specified children", () => {
		const block = build({
			name: "core/stack",
			children: [{ name: "core/accordion" }, { name: "core/form" }, { name: "core/group", children: [{ name: "core/paragraph" }] }],
		});
		const ids = [...collectBlockIds([block])];
		expect(ids).toHaveLength(countBlocks([block]));
		for (const id of ids) expect(id).toMatch(/^id-\d+$/);
		expect(block.id).toBe("id-1");
	});

	it("sets parentId on every nested child", () => {
		const block = build({ name: "core/stack", children: [{ name: "core/group", children: [{ name: "core/paragraph" }] }] }, null);
		const group = block.children?.[0];
		expect(block.parentId).toBeNull();
		expect(group?.parentId).toBe(block.id);
		expect(group?.children?.[0].parentId).toBe(group?.id);
	});
});

describe("buildBlockFromSpec: children", () => {
	it("keeps the starting children when the spec gives none", () => {
		expect(build({ name: "core/accordion" }).children).toHaveLength(3);
		const form = build({ name: "core/form" });
		expect(form.children?.map((child) => child.name)).toEqual(["core/input", "core/input", "core/textarea", "core/button"]);
		expect(form.children?.every((child) => child.parentId === form.id)).toBe(true);
	});

	it("replaces the starting children when the spec gives some, even an empty list", () => {
		const form = build({ name: "core/form", children: [{ name: "core/input", content: { name: "email" } }] });
		expect(form.children).toHaveLength(1);
		expect(form.children?.[0].content).toMatchObject({ kind: "structured", data: { name: "email", type: "text" } });
		expect(build({ name: "core/accordion", children: [] }).children).toEqual([]);
	});

	it("gives Columns one equal column per child, so the page draws them side by side", () => {
		const group = (title: string) => ({ name: "core/group" as const, children: [{ name: "core/heading" as const, content: { value: title } }] });
		const columns = build({ name: "core/columns", children: [group("One"), group("Two"), group("Three")] });
		const childIds = columns.children?.map((child) => child.id) ?? [];

		expect(readColumnLayoutFromBlock(columns).map((column) => column.blockIds)).toEqual(childIds.map((id) => [id]));
		expect(columns.settings?.columnLayout.map((column: { width: string }) => column.width)).toEqual(["33.33%", "33.33%", "33.33%"]);
		expect(build({ name: "core/columns" }).settings?.columnLayout).toBeUndefined();
		expect(build({ name: "core/stack", children: [group("One")] }).settings?.columnLayout).toBeUndefined();
	});

	it("refuses children on a block that cannot hold any, naming the block and the way out", () => {
		const result = buildBlockFromSpec({
			spec: { name: "core/stack", children: [{ name: "core/heading", children: [{ name: "core/paragraph" }] }] },
			parentId: null,
			newId: counter(),
		});
		expect(result).toEqual({
			ok: false,
			message: "core/stack > children[0]: core/heading can't hold other blocks, so it can't have children. Put them in a container such as core/stack.",
		});
		expect(build({ name: "core/heading", children: [] }).children).toBeUndefined();
	});

	it("refuses an unknown name anywhere in the spec, with the path", () => {
		const result = buildBlockFromSpec({
			spec: { name: "core/stack", children: [{ name: "core/group", children: [{ name: "core/nope" as never }] }] },
			parentId: null,
			newId: counter(),
		});
		expect(result).toEqual({
			ok: false,
			message: 'core/stack > children[0] > children[0]: unknown block name "core/nope". Call list_block_types for the valid names.',
		});
	});
});

describe("mergeBlockUpdate", () => {
	const heading = (): BlockConfig => makeBlock({ name: "core/heading", id: "h", content: { kind: "text", value: "Old", level: 2 } });

	it("merges text content fields and keeps the rest", () => {
		const result = mergeBlockUpdate({ block: heading(), content: { value: "New" } });
		expect(result).toEqual({
			ok: true,
			value: { op: "update", id: "h", set: { content: { kind: "text", value: "New", level: 2 } } },
		});
	});

	it("merges structured fields into data and null removes one", () => {
		const stack = makeBlock({ name: "core/stack", id: "s", content: { kind: "structured", data: { stackType: "vertical", extra: 1 } } });
		const result = mergeBlockUpdate({ block: stack, content: { stackType: "horizontal", extra: null } });
		expect(result.ok && result.value.set.content).toEqual({ kind: "structured", data: { stackType: "horizontal" } });
	});

	it("shallow-merges plain content", () => {
		const toc = makeBlock({ name: "post/toc", id: "t" });
		const result = mergeBlockUpdate({ block: toc, content: { sticky: true } });
		expect(result.ok && result.value.set.content).toMatchObject({ title: "Table of Contents", sticky: true });
	});

	it("merges styles, null removes, and only the sent parts appear in the op", () => {
		const block = makeBlock({ name: "core/heading", id: "h", styles: { color: "blue", margin: "4px" } });
		const result = mergeBlockUpdate({ block, styles: { color: "red", margin: null } });
		expect(result.ok && result.value.set).toEqual({ styles: expect.objectContaining({ color: "red" }) });
		expect(result.ok && result.value.set.styles).not.toHaveProperty("margin");
		expect(result.ok && result.value.set.content).toBeUndefined();
	});

	it("sets a label, and refuses an update that changes nothing", () => {
		expect(mergeBlockUpdate({ block: heading(), label: "Top" })).toEqual({ ok: true, value: { op: "update", id: "h", set: { label: "Top" } } });
		expect(mergeBlockUpdate({ block: heading() })).toEqual({ ok: false, message: "Nothing to change on h: send label, content or styles." });
	});

	it("does not touch the block it was given", () => {
		const block = heading();
		const copy = structuredClone(block);
		mergeBlockUpdate({ block, content: { value: "New" }, styles: { color: "red" } });
		expect(block).toEqual(copy);
	});
});
