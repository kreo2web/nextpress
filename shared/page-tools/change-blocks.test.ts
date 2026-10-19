import { describe, expect, it } from "vitest";
import { findBlockById } from "./tree-find.js";
import { changeBlocks as change, childrenOf, makeParagraph, makeSamplePage, UUID_PATTERN } from "./test-support/memory-context.js";

describe("change_blocks: where blocks land", () => {
	it("puts an insert at the page root inside the page shell, at the end", async () => {
		const { result, writes, getTree } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: null, block: { name: "core/paragraph", content: { value: "Footer words" } } }],
		});
		expect(result.ok).toBe(true);
		expect(writes).toHaveLength(1);
		const tree = getTree();
		expect(tree).toHaveLength(1);
		const shellChildren = childrenOf(tree, "shell");
		expect(shellChildren.map((child) => child.id).slice(0, 2)).toEqual(["hero", "outro"]);
		const added = shellChildren[2];
		expect(added.name).toBe("core/paragraph");
		expect(added.parentId).toBe("shell");
		expect(added.content).toMatchObject({ kind: "text", value: "Footer words" });
		expect(result.text).toContain("placed inside the page shell");
	});

	it("puts a header first inside the shell, and honours an index for other blocks", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: null, index: 1, block: { name: "core/paragraph" } },
				{ op: "insert", parentId: null, block: { name: "core/header" } },
			],
		});
		const names = childrenOf(getTree(), "shell").map((child) => child.name);
		expect(names).toEqual(["core/header", "core/stack", "core/paragraph", "core/paragraph"]);
	});

	it("leaves a root insert at the root when the page has no shell", async () => {
		const { getTree } = await change({
			blocks: [makeParagraph({ id: "only", text: "x" })],
			ops: [{ op: "insert", parentId: null, index: 0, block: { name: "core/heading" } }],
		});
		expect(getTree().map((block) => block.name)).toEqual(["core/heading", "core/paragraph"]);
	});

	it("sends a root insert after a new shell, in the same call, into that shell", async () => {
		const { getTree, result } = await change({
			blocks: [],
			ops: [
				{ op: "insert", parentId: null, block: { name: "core/page-shell" } },
				{ op: "insert", parentId: null, block: { name: "core/heading", content: { value: "Hi", level: 1 } } },
			],
		});
		expect(result.ok).toBe(true);
		const tree = getTree();
		expect(tree).toHaveLength(1);
		expect(tree[0].children?.[0].name).toBe("core/heading");
	});

	it("moves a block to the root into the shell too", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "move", id: "intro", parentId: null, index: 0 }],
		});
		expect(childrenOf(getTree(), "shell").map((child) => child.id)).toEqual(["intro", "hero", "outro"]);
		expect(findBlockById({ blocks: getTree(), id: "intro" })?.parentId).toBe("shell");
	});

	it("refuses a second page shell and a leaf as a parent, naming the id", async () => {
		const second = await change({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: null, block: { name: "core/page-shell" } }] });
		expect(second.result.ok).toBe(false);
		expect(second.result.text).toContain("already has a page shell (id shell)");

		const leaf = await change({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: "title", block: { name: "core/paragraph" } }] });
		expect(leaf.result.ok).toBe(false);
		expect(leaf.result.text).toContain("Block title (core/heading) can't hold other blocks");
		expect(leaf.writes).toHaveLength(0);
	});
});

describe("change_blocks: replace, update, delete, move", () => {
	it("replace keeps the position and swaps the whole subtree", async () => {
		const { result, getTree, writes } = await change({
			blocks: makeSamplePage(),
			ops: [
				{
					op: "replace",
					id: "hero",
					block: { name: "core/group", children: [{ name: "core/heading", content: { value: "New", level: 1 } }] },
				},
			],
		});
		expect(result.ok).toBe(true);
		const shellChildren = childrenOf(getTree(), "shell");
		expect(shellChildren).toHaveLength(2);
		expect(shellChildren[0].name).toBe("core/group");
		expect(shellChildren[0].id).not.toBe("hero");
		expect(shellChildren[1].id).toBe("outro");
		expect(findBlockById({ blocks: getTree(), id: "title" })).toBeNull();
		expect(writes[0].summary.replaced).toEqual([shellChildren[0].id]);
		expect(result.text).toContain(shellChildren[0].id);
	});

	it("update merges: only the named fields change, null removes", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "update", id: "title", content: { level: 3 }, styles: { color: "red", margin: null } },
				{ op: "update", id: "hero", label: "Top" },
			],
		});
		const title = findBlockById({ blocks: getTree(), id: "title" });
		expect(title?.content).toMatchObject({ kind: "text", value: "Welcome", level: 3 });
		expect(title?.styles).toMatchObject({ color: "red" });
		expect(title?.styles).not.toHaveProperty("margin");
		expect(title?.styles).toHaveProperty("padding");
		expect(findBlockById({ blocks: getTree(), id: "hero" })?.label).toBe("Top");
	});

	it("deletes and moves blocks", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "move", id: "outro", parentId: "hero", index: 0 },
				{ op: "delete", id: "intro" },
			],
		});
		expect(childrenOf(getTree(), "hero").map((child) => child.id)).toEqual(["outro", "title"]);
	});

	it("names the id when a block is missing", async () => {
		const { result, writes } = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "nope", label: "x" }] });
		expect(result).toEqual({ ok: false, text: "Nothing was changed. Op 1 (update): No block with id nope. Read the outline again." });
		expect(writes).toHaveLength(0);
	});

	it("will not delete or replace the page shell with something else, or move a block into itself", async () => {
		const del = await change({ blocks: makeSamplePage(), ops: [{ op: "delete", id: "shell" }] });
		expect(del.result.text).toContain("page shell and can't be deleted");
		const swap = await change({ blocks: makeSamplePage(), ops: [{ op: "replace", id: "shell", block: { name: "core/stack" } }] });
		expect(swap.result.text).toContain("can't be replaced by another kind of block");
		const loop = await change({ blocks: makeSamplePage(), ops: [{ op: "move", id: "hero", parentId: "intro" }] });
		expect(loop.result.ok).toBe(false);
		const into = await change({ blocks: makeSamplePage(), ops: [{ op: "move", id: "shell", parentId: "hero" }] });
		expect(into.result.text).toContain("into itself");
		for (const refused of [del, swap, loop, into]) expect(refused.writes).toHaveLength(0);
	});
});

describe("change_blocks: the selected block", () => {
	it("refuses a change outside the selected block and writes nothing", async () => {
		const before = makeSamplePage();
		const { result, writes, getTree } = await change({
			blocks: before,
			focusBlockId: "hero",
			ops: [{ op: "update", id: "outro", content: { value: "Changed" } }],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Block outro is outside the selected block (id hero)");
		expect(writes).toHaveLength(0);
		expect(getTree()).toEqual(before);
	});

	it("is all or nothing: one op outside the selection cancels the ops inside it", async () => {
		const before = makeSamplePage();
		const { result, writes, getTree } = await change({
			blocks: before,
			focusBlockId: "hero",
			ops: [
				{ op: "update", id: "title", content: { value: "Allowed" } },
				{ op: "insert", parentId: null, block: { name: "core/paragraph" } },
			],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Op 2 (insert)");
		expect(writes).toHaveLength(0);
		expect(getTree()).toEqual(before);
	});

	it("allows inserts, updates and moves inside the selected block", async () => {
		const { result, getTree } = await change({
			blocks: makeSamplePage(),
			focusBlockId: "hero",
			ops: [
				{ op: "insert", parentId: "hero", index: 0, block: { name: "core/paragraph", content: { value: "Inside" } } },
				{ op: "move", id: "intro", parentId: "hero", index: 0 },
			],
		});
		expect(result.ok).toBe(true);
		expect(childrenOf(getTree(), "hero")).toHaveLength(3);
	});

	it("refuses to move an outside block into the selection, and the selection itself away", async () => {
		const into = await change({ blocks: makeSamplePage(), focusBlockId: "hero", ops: [{ op: "move", id: "outro", parentId: "hero" }] });
		expect(into.result.text).toContain("outside the selected block");
		const away = await change({ blocks: makeSamplePage(), focusBlockId: "hero", ops: [{ op: "move", id: "hero", parentId: "shell", index: 0 }] });
		expect(away.result.text).toContain("can't be moved");
	});

	it("refuses to delete the selected block but lets it be replaced, keeping its id", async () => {
		const del = await change({ blocks: makeSamplePage(), focusBlockId: "hero", ops: [{ op: "delete", id: "hero" }] });
		expect(del.result.ok).toBe(false);
		expect(del.result.text).toContain("can't be deleted");

		const swap = await change({
			blocks: makeSamplePage(),
			focusBlockId: "hero",
			ops: [{ op: "replace", id: "hero", block: { name: "core/group", children: [{ name: "core/paragraph" }] } }],
		});
		expect(swap.result.ok).toBe(true);
		expect(childrenOf(swap.getTree(), "shell")[0].id).toBe("hero");
		expect(findBlockById({ blocks: swap.getTree(), id: "hero" })?.name).toBe("core/group");
		const [child] = childrenOf(swap.getTree(), "hero");
		expect(child.id).toMatch(UUID_PATTERN);
	});

	it("sends a root insert into the shell and refuses it when the shell is outside the selection", async () => {
		const { result } = await change({
			blocks: makeSamplePage(),
			focusBlockId: "hero",
			ops: [{ op: "insert", parentId: null, block: { name: "core/paragraph" } }],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Block shell is outside the selected block");

		const wholePage = await change({
			blocks: makeSamplePage(),
			focusBlockId: "shell",
			ops: [{ op: "insert", parentId: null, block: { name: "core/paragraph" } }],
		});
		expect(wholePage.result.ok).toBe(true);
	});

	it("says so when the selected block is gone", async () => {
		const { result } = await change({ blocks: makeSamplePage(), focusBlockId: "ghost", ops: [{ op: "update", id: "title", label: "x" }] });
		expect(result.text).toContain("selected block (id ghost) is no longer on the page");
	});
});
