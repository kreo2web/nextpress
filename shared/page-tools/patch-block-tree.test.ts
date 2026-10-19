import { describe, expect, it } from "vitest";
import { checkBlockStructure } from "./check-block-structure.js";
import { normalizeBlockTree } from "./normalize-block-tree.js";
import { patchBlockTree } from "./patch-block-tree.js";
import { retargetRootIntoShell } from "./retarget-root-into-shell.js";
import { makeBlock, makeHeading, makeParagraph, makeSamplePage } from "./test-support/memory-context.js";

describe("patchBlockTree", () => {
	it("inserts, updates, moves and deletes, and reports each id", () => {
		const result = patchBlockTree({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: "hero", index: 0, block: makeParagraph({ id: "new", text: "N" }) },
				{ op: "update", id: "title", set: { label: "Main" } },
				{ op: "move", id: "outro", parentId: "hero" },
				{ op: "delete", id: "intro" },
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.summary).toEqual({ inserted: ["new"], updated: ["title"], deleted: ["intro"], moved: ["outro"], replaced: [] });
		const hero = result.blocks[0].children?.[0];
		expect(hero?.children?.map((child) => child.id)).toEqual(["new", "title", "outro"]);
		expect(hero?.children?.every((child) => child.parentId === "hero")).toBe(true);
	});

	it("does not change the tree it was given", () => {
		const page = makeSamplePage();
		const copy = structuredClone(page);
		patchBlockTree({ blocks: page, ops: [{ op: "delete", id: "title" }] });
		expect(page).toEqual(copy);
	});

	it("fails with the op index and id when a block is missing or an id is taken", () => {
		const missing = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "delete", id: "title" }, { op: "delete", id: "ghost" }] });
		expect(missing).toEqual({ ok: false, error: { code: "PATCH_FAILED", message: 'delete id "ghost" not found', opIndex: 1, blockId: "ghost" } });
		const taken = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: null, block: makeParagraph({ id: "title", text: "x" }) }] });
		expect(taken.ok).toBe(false);
		const loop = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "move", id: "hero", parentId: "title" }] });
		expect(loop.ok).toBe(false);
	});

	it("validates unless told not to", () => {
		const bad = { ...makeParagraph({ id: "b", text: "x" }), name: "core/imaginary" };
		const ops = [{ op: "insert" as const, parentId: null, block: bad }];
		const checked = patchBlockTree({ blocks: [], ops });
		expect(checked.ok).toBe(false);
		if (!checked.ok) expect(checked.error.code).toBe("VALIDATION_FAILED");
		expect(patchBlockTree({ blocks: [], ops, validate: false }).ok).toBe(true);
	});
});

describe("patchBlockTree: replace", () => {
	it("swaps the block and its whole subtree in the same place", () => {
		const result = patchBlockTree({
			blocks: makeSamplePage(),
			ops: [{ op: "replace", id: "hero", block: makeBlock({ name: "core/group", id: "fresh", children: [makeHeading({ id: "fresh-h", text: "New" })] }) }],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const shell = result.blocks[0];
		expect(shell.children?.map((child) => child.id)).toEqual(["fresh", "outro"]);
		expect(shell.children?.[0].parentId).toBe("shell");
		expect(shell.children?.[0].children?.[0].parentId).toBe("fresh");
		expect(JSON.stringify(result.blocks)).not.toContain('"title"');
		expect(result.summary.replaced).toEqual(["fresh"]);
	});

	it("replaces a root block", () => {
		const result = patchBlockTree({ blocks: [makeParagraph({ id: "a", text: "1" }), makeParagraph({ id: "b", text: "2" })], ops: [{ op: "replace", id: "a", block: makeHeading({ id: "c", text: "3" }) }] });
		expect(result.ok && result.blocks.map((block) => block.id)).toEqual(["c", "b"]);
	});

	it("refuses when the id is missing", () => {
		const result = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "replace", id: "ghost", block: makeParagraph({ id: "n", text: "x" }) }] });
		expect(result).toEqual({ ok: false, error: { code: "PATCH_FAILED", message: 'replace id "ghost" not found', opIndex: 0, blockId: "ghost" } });
	});

	it("refuses when the new block's id already exists elsewhere", () => {
		const result = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "replace", id: "hero", block: makeParagraph({ id: "outro", text: "x" }) }] });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toBe('replace: id "outro" already exists elsewhere on the page');
		const deep = patchBlockTree({
			blocks: makeSamplePage(),
			ops: [{ op: "replace", id: "hero", block: makeBlock({ name: "core/group", id: "g", children: [makeParagraph({ id: "outro", text: "x" })] }) }],
		});
		expect(deep.ok).toBe(false);
	});

	it("allows the new block to reuse the replaced block's id, or an id from inside it", () => {
		const same = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "replace", id: "hero", block: makeBlock({ name: "core/group", id: "hero" }) }] });
		expect(same.ok && same.blocks[0].children?.[0].name).toBe("core/group");
		const inner = patchBlockTree({ blocks: makeSamplePage(), ops: [{ op: "replace", id: "hero", block: makeParagraph({ id: "title", text: "x" }) }] });
		expect(inner.ok).toBe(true);
	});
});

describe("checkBlockStructure and normalizeBlockTree", () => {
	it("counts blocks and finds nothing wrong on a clean page", () => {
		expect(checkBlockStructure(makeSamplePage())).toEqual({ ok: true, blockCount: 5 });
	});

	it("gives the issue codes the SDK always used", () => {
		const result = checkBlockStructure([
			{ ...makeParagraph({ id: "a", text: "x" }), name: "core/imaginary" },
			makeParagraph({ id: "d", text: "x" }),
			makeParagraph({ id: "d", text: "x" }),
			{ ...makeParagraph({ id: "t", text: "x" }), type: "container" },
			{ ...makeParagraph({ id: "l", text: "x" }), children: [makeParagraph({ id: "k", text: "x" })] },
			{ ...makeParagraph({ id: "", text: "x" }) },
		]);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues.map((issue) => issue.code).sort()).toEqual([
			"DUPLICATE_BLOCK_ID",
			"INVALID_BLOCK_STRUCTURE",
			"INVALID_BLOCK_STRUCTURE",
			"INVALID_BLOCK_TYPE",
			"UNKNOWN_BLOCK",
		]);
	});

	it("sets parentId down the whole tree", () => {
		const flat = makeSamplePage().map((root) => ({ ...root, parentId: "wrong" }));
		const normalized = normalizeBlockTree(flat, null);
		expect(normalized[0].parentId).toBeNull();
		expect(normalized[0].children?.[0].children?.[0].parentId).toBe("hero");
	});
});

describe("retargetRootIntoShell", () => {
	const page = makeSamplePage();

	it("sends a root drop into the shell, clamped to its children", () => {
		expect(retargetRootIntoShell({ blocks: page, name: "core/paragraph", parentId: null, index: 99 })).toEqual({ parentId: "shell", index: 2 });
		expect(retargetRootIntoShell({ blocks: page, name: "core/paragraph", parentId: null, index: -4 })).toEqual({ parentId: "shell", index: 0 });
		expect(retargetRootIntoShell({ blocks: page, name: "core/paragraph", parentId: null, index: 1 })).toEqual({ parentId: "shell", index: 1 });
	});

	it("always puts a header first", () => {
		expect(retargetRootIntoShell({ blocks: page, name: "core/header", parentId: null, index: 2 })).toEqual({ parentId: "shell", index: 0 });
	});

	it("leaves the shell itself, other parents and shell-less pages alone", () => {
		expect(retargetRootIntoShell({ blocks: page, name: "core/page-shell", parentId: null, index: 3 })).toEqual({ parentId: null, index: 3 });
		expect(retargetRootIntoShell({ blocks: page, name: "core/paragraph", parentId: "hero", index: 1 })).toEqual({ parentId: "hero", index: 1 });
		expect(retargetRootIntoShell({ blocks: [makeParagraph({ id: "a", text: "x" })], name: "core/paragraph", parentId: null, index: 1 })).toEqual({ parentId: null, index: 1 });
	});
});
