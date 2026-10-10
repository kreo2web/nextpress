import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types";
import {
	MAX_TEMPLATE_PART_DEPTH,
	TEMPLATE_PART_BLOCK_NAME,
	buildTemplatePartBlock,
	collectTemplatePartIds,
	copyTemplateBlocks,
	hasTemplatePartBlock,
	isTemplatePartBlock,
	readTemplatePartId,
	unwrapPageShells,
} from "./index";

const text = (id: string, value: string, parentId: string | null = null): BlockConfig => ({
	id,
	name: "core/paragraph",
	type: "block",
	parentId,
	content: { kind: "text", value },
});

const shell = (id: string, children: BlockConfig[]): BlockConfig => ({
	id,
	name: "core/page-shell",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: { containerWidth: "1200px" } },
	children: children.map((child) => ({ ...child, parentId: id })),
});

const part = (id: string, templateId: string, parentId: string | null = null): BlockConfig => ({
	...buildTemplatePartBlock({ id, templateId }),
	parentId,
});

describe("template part block", () => {
	it("reads the template id from structured content", () => {
		expect(readTemplatePartId(part("p1", "tpl-1"))).toBe("tpl-1");
	});

	it("reads a bare templateId and ignores blank ids", () => {
		const bare = { ...part("p2", "x"), content: { templateId: " tpl-2 " } as unknown as BlockConfig["content"] };
		expect(readTemplatePartId(bare)).toBe("tpl-2");
		expect(readTemplatePartId(part("p3", "   "))).toBeNull();
	});

	it("builds a part with the canonical name and structured content", () => {
		const block = buildTemplatePartBlock({ id: "p4", templateId: "tpl-4" });
		expect(block.name).toBe(TEMPLATE_PART_BLOCK_NAME);
		expect(block.content).toEqual({ kind: "structured", data: { templateId: "tpl-4" } });
		expect(isTemplatePartBlock(block)).toBe(true);
	});

	it("allows at most three levels of nested templates", () => {
		expect(MAX_TEMPLATE_PART_DEPTH).toBe(3);
	});
});

describe("template part tree helpers", () => {
	it("finds parts at any depth", () => {
		expect(hasTemplatePartBlock([shell("s", [text("a", "x")])])).toBe(false);
		expect(hasTemplatePartBlock([shell("s", [text("a", "x"), part("p", "t")])])).toBe(true);
	});

	it("collects each template id once, in the order it first appears", () => {
		const tree = [shell("s", [part("p1", "tpl-a"), text("a", "x"), part("p2", "tpl-b"), part("p3", "tpl-a")])];
		expect(collectTemplatePartIds(tree)).toEqual(["tpl-a", "tpl-b"]);
	});

	it("unwraps root page shells and keeps their children in order", () => {
		const template = [shell("tshell", [text("h", "Header"), text("n", "Nav")])];
		expect(unwrapPageShells(template).map((block) => block.id)).toEqual(["h", "n"]);
	});

	it("keeps blocks that are not page shells", () => {
		const header: BlockConfig = { ...text("hd", "Logo"), name: "core/header" };
		expect(unwrapPageShells([header]).map((block) => block.id)).toEqual(["hd"]);
	});

	it("copies a template for a page: no shell, fresh ids, the part's parent", () => {
		let next = 0;
		const copies = copyTemplateBlocks({
			templateBlocks: [shell("tshell", [text("h", "Welcome"), text("n", "Nav")])],
			parentId: "page-shell",
			generateId: () => `new-${++next}`,
		});
		expect(copies.map((block) => block.name)).toEqual(["core/paragraph", "core/paragraph"]);
		expect(copies.map((block) => block.id)).toEqual(["new-1", "new-2"]);
		expect(copies.map((block) => block.parentId)).toEqual(["page-shell", "page-shell"]);
		expect(copies.map((block) => (block.content as { value: string }).value)).toEqual(["Welcome", "Nav"]);
	});

	it("points nested children of a copy at the copy's new ids", () => {
		let next = 0;
		const container: BlockConfig = {
			id: "c",
			name: "core/group",
			type: "container",
			parentId: null,
			content: { kind: "structured", data: {} },
			children: [text("inner", "Inside", "c")],
		};
		const [copied] = copyTemplateBlocks({
			templateBlocks: [container],
			parentId: null,
			generateId: () => `n-${++next}`,
		});
		expect(copied.id).toBe("n-1");
		expect(copied.children?.[0]).toMatchObject({ id: "n-2", parentId: "n-1" });
	});

	it("rewrites stored .block-<id> selectors so custom CSS still applies to the copy", () => {
		let next = 0;
		const styled: BlockConfig = { ...text("hero", "Hi"), customCss: ".block-hero { color: red; }" };
		const [copied] = copyTemplateBlocks({
			templateBlocks: [styled],
			parentId: null,
			generateId: () => `copy-${++next}`,
		});
		expect(copied.id).toBe("copy-1");
		expect(copied.customCss).toBe(".block-copy-1 { color: red; }");
	});
});
