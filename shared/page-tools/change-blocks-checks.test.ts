import { describe, expect, it } from "vitest";
import { createPageTools } from "./create-page-tools.js";
import { collectBlockIds, findBlockById } from "./tree-find.js";
import {
	changeBlocks as change,
	childrenOf,
	createMemoryContext,
	findTool,
	makeBlock,
	makeHeading,
	makeSamplePage,
	UUID_PATTERN,
} from "./test-support/memory-context.js";

describe("change_blocks: checks before writing", () => {
	it("refuses the whole call when the server would refuse to save, leaving the tree identical", async () => {
		const before = makeSamplePage();
		const { result, writes, getTree } = await change({
			blocks: before,
			ops: [
				{ op: "update", id: "title", content: { value: "Fine change" } },
				{ op: "insert", parentId: "hero", block: { name: "core/group", content: { tagName: "script" } } },
			],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Nothing was changed");
		expect(result.text).toContain("[save]");
		expect(result.text).toContain("Invalid group tagName: script");
		expect(writes).toHaveLength(0);
		expect(getTree()).toEqual(before);
	});

	it("accepts an unrelated change on a page that already has a problem, and names the old problem", async () => {
		const broken = makeSamplePage();
		broken[0].children?.push(makeBlock({ name: "core/group", id: "bad", content: { kind: "structured", data: { tagName: "script" } } }));
		const { result, writes } = await change({ blocks: broken, ops: [{ op: "update", id: "title", label: "x" }] });
		expect(result.ok).toBe(true);
		expect(writes).toHaveLength(1);
		expect(result.text).toContain("Already on the page before this change");
		expect(result.text).toContain("[save] block bad: The server would refuse to save this page: Invalid group tagName: script");
	});

	it("names at most three old problems and counts the rest", async () => {
		const broken = makeSamplePage();
		for (const id of ["a", "b", "c", "d", "e"]) {
			broken[0].children?.push(makeBlock({ name: "core/paragraph", id: `dup-${id}`, content: { kind: "text", value: "x" } }));
			broken[0].children?.push(makeBlock({ name: "core/paragraph", id: `dup-${id}`, content: { kind: "text", value: "y" } }));
		}
		const { result } = await change({ blocks: broken, ops: [{ op: "update", id: "title", label: "x" }] });
		expect(result.ok).toBe(true);
		expect(result.text.match(/^- \[structure\]/gm)).toHaveLength(3);
		expect(result.text).toContain("- and 2 more");
	});

	it("says nothing about old problems when the change removes them", async () => {
		const broken = makeSamplePage();
		broken[0].children?.push(makeBlock({ name: "core/group", id: "bad", content: { kind: "structured", data: { tagName: "script" } } }));
		const { result, getTree } = await change({ blocks: broken, ops: [{ op: "delete", id: "bad" }] });
		expect(result.ok).toBe(true);
		expect(result.text).not.toContain("Already on the page");
		expect(findBlockById({ blocks: getTree(), id: "bad" })).toBeNull();
	});

	it("refuses a new save problem hiding behind an old first error, and lists only the new one", async () => {
		const broken = makeSamplePage();
		// The old problem: a bad tag name. The server reports tag names before icons, so it hides a bad icon.
		broken[0].children?.push(makeBlock({ name: "core/group", id: "bad", content: { kind: "structured", data: { tagName: "script" } } }));
		const before = structuredClone(broken);
		const { result, writes, getTree } = await change({
			blocks: broken,
			ops: [
				{ op: "update", id: "title", label: "fine" },
				{ op: "insert", parentId: "hero", block: { name: "core/icon", content: { icon: { iconSet: "lucide", iconName: "no-such-icon-at-all" } } } },
			],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Nothing was changed. After these ops the page would have 1 new problem:");
		expect(result.text).toContain("[save]");
		expect(result.text).toContain("icon block");
		expect(result.text).not.toContain("tagName");
		expect(writes).toHaveLength(0);
		expect(getTree()).toEqual(before);
	});

	it("refuses a change that makes an old problem worse in a new place", async () => {
		const broken = makeSamplePage();
		broken[0].children?.push(makeBlock({ name: "core/group", id: "bad", content: { kind: "structured", data: { tagName: "script" } } }));
		const { result } = await change({
			blocks: broken,
			ops: [{ op: "insert", parentId: "hero", block: { name: "core/group", content: { tagName: "iframe" } } }],
		});
		expect(result.ok).toBe(false);
		expect(result.text).toContain("Invalid group tagName: iframe");
		expect(result.text).not.toContain("tagName: script");
	});

	it("reports phone warnings for the blocks it touched without blocking the change", async () => {
		const { result, writes } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "core/group", label: "Wide box", styles: { width: "900px" } } }],
		});
		expect(result.ok).toBe(true);
		expect(writes).toHaveLength(1);
		expect(result.text).toContain("Phone warnings");
		expect(result.text).toContain("900px wide");
		expect(result.text).toContain("apply_phone_fixes");
	});

	it("does not repeat phone warnings from blocks it did not touch", async () => {
		const page = makeSamplePage();
		page[0].children?.push(makeBlock({ name: "core/group", id: "wide", styles: { width: "900px" } }));
		const { result } = await change({ blocks: page, ops: [{ op: "update", id: "title", label: "x" }] });
		expect(result.ok).toBe(true);
		expect(result.text).not.toContain("Phone warnings");
	});

	it("reports a failed write as a failed call", async () => {
		const memory = createMemoryContext({ blocks: makeSamplePage(), failWrite: "The editor is locked." });
		const result = await findTool(createPageTools(memory.ctx), "change_blocks").run({
			ops: [{ op: "update", id: "title", label: "x" }],
		});
		expect(result).toEqual({ ok: false, text: "The page was not updated: The editor is locked." });
		expect(memory.writes).toHaveLength(0);
	});

	it("turns a throwing writeTree or readTree into a failed result and reports the cause", async () => {
		const memory = createMemoryContext({ blocks: makeSamplePage() });
		memory.ctx.writeTree = async () => {
			throw new Error("disk full");
		};
		const write = await findTool(createPageTools(memory.ctx), "change_blocks").run({ ops: [{ op: "update", id: "title", label: "x" }] });
		expect(write.ok).toBe(false);
		expect(write.text).toContain("disk full");
		expect(memory.errors).toEqual([{ tool: "writeTree", message: "disk full" }]);

		memory.ctx.readTree = async () => {
			throw new Error("no connection");
		};
		const read = await findTool(createPageTools(memory.ctx), "change_blocks").run({ ops: [{ op: "update", id: "title", label: "x" }] });
		expect(read.ok).toBe(false);
		expect(read.text).toContain("no connection");
		expect(memory.errors.at(-1)).toEqual({ tool: "readTree", message: "no connection" });
	});
});

describe("change_blocks: new blocks", () => {
	it("gives every new block a UUID, starting children and nested specs included", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{
					op: "insert",
					parentId: "hero",
					block: {
						name: "core/stack",
						children: [
							{ name: "core/heading", content: { value: "A", level: 2 } },
							{ name: "core/group", children: [{ name: "core/paragraph" }] },
						],
					},
				},
				{ op: "insert", parentId: "hero", block: { name: "core/accordion" } },
				{ op: "insert", parentId: "hero", block: { name: "core/form" } },
			],
		});
		const original = new Set(["shell", "hero", "title", "intro", "outro"]);
		const added = [...collectBlockIds(getTree())].filter((id) => !original.has(id));
		expect(added.length).toBeGreaterThanOrEqual(1 + 1 + 1 + 1 + 4 + 1 + 3 + 4);
		for (const id of added) expect(id).toMatch(UUID_PATTERN);
	});

	it("returns the outline of what it made, with the new ids", async () => {
		const { result, getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{
					op: "insert",
					parentId: "hero",
					block: { name: "core/stack", label: "Cards", children: [{ name: "core/heading", content: { value: "Card one", level: 3 } }] },
				},
			],
		});
		const stack = childrenOf(getTree(), "hero").find((child) => child.name === "core/stack");
		expect(result.text).toContain("Done: inserted 1.");
		expect(result.text).toContain(`stack id=${stack?.id} label="Cards" stack=vertical`);
		expect(result.text).toContain(`heading id=${stack?.children?.[0].id} level=3 text="Card one"`);
	});

	it("folds the outline of a big new subtree", async () => {
		const row = { name: "core/group", children: Array.from({ length: 3 }, () => ({ name: "core/paragraph" })) };
		const column = { name: "core/group", children: Array.from({ length: 3 }, () => row) };
		const { result } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "core/stack", children: Array.from({ length: 6 }, () => column) } }],
		});
		expect(result.ok).toBe(true);
		expect(result.text).toContain("(+3 inside)");
		expect(result.text).not.toContain("paragraph id=");
		expect(result.text).toContain("deeper blocks are folded");
	});
});

describe("change_blocks: limits and bad input", () => {
	it("refuses more than 50 ops with an exact message", async () => {
		const ops = Array.from({ length: 51 }, () => ({ op: "insert", parentId: "hero", block: { name: "core/paragraph" } }));
		const { result, writes } = await change({ blocks: makeSamplePage(), ops });
		expect(result.ok).toBe(false);
		expect(result.text).toContain("ops: At most 50 ops per call. Split the work into several calls.");
		expect(writes).toHaveLength(0);
	});

	it("accepts exactly 50 ops", async () => {
		const ops = Array.from({ length: 50 }, () => ({ op: "insert", parentId: "hero", block: { name: "core/paragraph" } }));
		const { result, getTree } = await change({ blocks: makeSamplePage(), ops });
		expect(result.ok).toBe(true);
		expect(childrenOf(getTree(), "hero")).toHaveLength(52);
	});

	it("refuses a call that would create more than 300 blocks, and writes nothing", async () => {
		const section = {
			op: "insert",
			parentId: "hero",
			block: { name: "core/stack", children: Array.from({ length: 80 }, () => ({ name: "core/paragraph" })) },
		};
		const under = await change({ blocks: makeSamplePage(), ops: [section, section, section] });
		expect(under.result.ok).toBe(true);

		const over = await change({ blocks: makeSamplePage(), ops: [section, section, section, section] });
		expect(over.result.ok).toBe(false);
		expect(over.result.text).toContain("Op 4 (insert): this call would create more than 300 blocks");
		expect(over.writes).toHaveLength(0);
		expect(collectBlockIds(over.getTree()).size).toBe(5);
	});

	it("counts a block's starting children toward the 300", async () => {
		const forms = Array.from({ length: 70 }, () => ({ op: "insert", parentId: "hero", block: { name: "core/form" } }));
		const { result } = await change({ blocks: makeSamplePage(), ops: forms.slice(0, 50) });
		// 50 forms x (1 form + 4 starting children) = 250 blocks: allowed.
		expect(result.ok).toBe(true);
		const tooMany = await change({ blocks: makeSamplePage(), ops: [...forms.slice(0, 50), ...forms.slice(0, 20)] });
		expect(tooMany.result.ok).toBe(false);
	});

	it("returns ok: false with a useful text instead of throwing on bad input", async () => {
		const memory = createMemoryContext({ blocks: makeSamplePage() });
		const tool = findTool(createPageTools(memory.ctx), "change_blocks");

		const missing = await tool.run({});
		expect(missing.ok).toBe(false);
		expect(missing.text).toContain("ops: Required");

		const empty = await tool.run({ ops: [] });
		expect(empty.text).toContain("ops: Send at least one op.");

		const wrongType = await tool.run({ ops: "insert something" });
		expect(wrongType.ok).toBe(false);

		const badOp = await tool.run({ ops: [{ op: "explode", id: "x" }] });
		expect(badOp.text).toContain("ops[0]");
		expect(badOp.text).toContain("'insert' | 'update' | 'delete' | 'move' | 'replace'");

		const badName = await tool.run({ ops: [{ op: "insert", parentId: null, block: { name: "core/nope" } }] });
		expect(badName.text).toContain('ops[0].block.name: Unknown block name "core/nope". Call list_block_types for the valid names.');

		const stray = await tool.run({ ops: [{ op: "insert", parentId: null, block: { name: "core/heading", text: "Hi" } }] });
		expect(stray.text).toContain("Fields such as value, url or level go inside content. (not allowed here: text)");

		const deep = await tool.run({
			ops: [
				{
					op: "insert",
					parentId: null,
					block: { name: "core/stack", children: [{ name: "core/stack", children: [{ name: "core/stack", children: [{ name: "core/stack", children: [{ name: "core/stack" }] }] }] }] },
				},
			],
		});
		expect(deep.ok).toBe(false);
		expect(deep.text).toContain("No children this deep (four levels at most): give the block a ref and insert into it in a later op.");
		expect(deep.text).toContain("(not allowed here: children)");

		expect(memory.writes).toHaveLength(0);
	});

	it("refuses content that tries to change the block's kind or wrap fields in data", async () => {
		const kind = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "title", content: { kind: "markdown" } }] });
		expect(kind.result.text).toContain("content.kind can't be changed");
		const wrapped = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "hero", content: { data: { stackType: "horizontal" } } }] });
		expect(wrapped.result.text).toContain("keeps its fields flat");
	});

	it("runs changes sent together one after another, so none is lost", async () => {
		const memory = createMemoryContext({ blocks: makeSamplePage() });
		const tool = findTool(createPageTools(memory.ctx), "change_blocks");
		const results = await Promise.all(
			Array.from({ length: 5 }, (_, i) =>
				tool.run({ ops: [{ op: "insert", parentId: "hero", block: { name: "core/paragraph", content: { value: `P${i}` } } }] }),
			),
		);
		expect(results.every((result) => result.ok)).toBe(true);
		expect(childrenOf(memory.getTree(), "hero")).toHaveLength(7);
		expect(memory.writes).toHaveLength(5);
	});
});

describe("change_blocks: the tool itself", () => {
	it("describes itself for a model and marks itself as changing the page", () => {
		const tool = findTool(createPageTools(createMemoryContext({ blocks: [] }).ctx), "change_blocks");
		expect(tool.changesPage).toBe(true);
		expect(tool.description).toContain("all-or-nothing");
		expect(tool.description).toContain("four levels deep");
		expect(Object.keys(tool.inputShape)).toEqual(["ops"]);
	});

	it("builds headings and paragraphs from content the way the editor stores them", async () => {
		const { getTree } = await change({
			blocks: [makeHeading({ id: "h", text: "Old" })],
			ops: [{ op: "replace", id: "h", block: { name: "core/heading", content: { value: "New", level: 1 } } }],
		});
		expect(getTree()[0].content).toMatchObject({ kind: "text", value: "New", level: 1 });
	});
});
