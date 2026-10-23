import { describe, expect, it } from "vitest";
import { PAGE_CLEAN_LINE } from "./commit-change.js";
import { findBlockById } from "./tree-find.js";
import { changeBlocks as change, childrenOf, makeBlock, makeSamplePage, UUID_PATTERN } from "./test-support/memory-context.js";

const overlayHero = () =>
	makeSamplePage().map((shell) => ({
		...shell,
		children: [
			...(shell.children ?? []),
			makeBlock({ name: "core/stack", id: "layers", content: { kind: "structured", data: { stackType: "overlay" } } }),
		],
	}));

describe("change_blocks: block names", () => {
	it("takes a core block's name without core/, the way the outline prints it", async () => {
		const { result, getTree } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "list", content: { values: "<li>One</li>" } } }],
		});
		expect(result.ok).toBe(true);
		expect(childrenOf(getTree(), "hero").at(-1)?.name).toBe("core/list");
	});

	it("keeps post/ blocks behind their prefix and suggests the full name", async () => {
		const { result } = await change({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: "hero", block: { name: "title" } }] });
		expect(result.ok).toBe(false);
		expect(result.text).toContain('Unknown block name "title". Did you mean post/title?');
	});
});

describe("change_blocks: refs", () => {
	it("builds a section and fills it in one call by ref, and maps each ref to its id", async () => {
		const { result, getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: null, block: { name: "stack", ref: "features", label: "Features" } },
				{ op: "insert", parentId: "features", block: { name: "heading", ref: "title2", content: { value: "Why us" } } },
				{ op: "update", id: "title2", content: { level: 2 } },
			],
		});
		expect(result.ok).toBe(true);
		const section = childrenOf(getTree(), "shell").at(-1);
		expect(section?.label).toBe("Features");
		const heading = section?.children?.at(-1);
		expect(heading?.content).toMatchObject({ kind: "text", value: "Why us", level: 2 });
		expect(result.text).toContain(`Refs (this call only; use the ids from now on): features=${section?.id}, title2=${heading?.id}`);
	});

	it("finds refs on children too", async () => {
		const { result, getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: "hero", block: { name: "columns", children: [{ name: "group", ref: "left" }, { name: "group", ref: "right" }] } },
				{ op: "insert", parentId: "right", block: { name: "paragraph", content: { value: "On the right" } } },
			],
		});
		expect(result.ok).toBe(true);
		const columns = childrenOf(getTree(), "hero").at(-1);
		expect(columns?.children?.[1].children?.[0].content).toMatchObject({ value: "On the right" });
	});

	it("refuses a ref used twice, a ref that is a real id, and a ref used before it exists, changing nothing", async () => {
		const twice = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: "hero", block: { name: "group", ref: "box" } },
				{ op: "insert", parentId: "hero", block: { name: "group", ref: "box" } },
			],
		});
		expect(twice.result.text).toContain('Op 2 (insert): ref "box" is used twice in this call.');
		expect(twice.writes).toHaveLength(0);

		const taken = await change({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: "hero", block: { name: "group", ref: "outro" } }] });
		expect(taken.result.text).toContain('ref "outro" is already the id of a block on the page.');

		const early = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: "later", block: { name: "paragraph" } },
				{ op: "insert", parentId: "hero", block: { name: "group", ref: "later" } },
			],
		});
		expect(early.result.text).toContain("No block with id later. Read the outline again for ids; a ref only works in ops after the one that made it");
	});

	it("moves a ref off the op into the block when a model puts it there", async () => {
		const { repairChangeBlocksInput } = await import("./repair-change-blocks-input.js");
		const fixed = await repairChangeBlocksInput(
			JSON.stringify({ ops: [{ op: "insert", parentId: null, ref: "hero", block: { name: "stack" } }] }),
		);
		expect(fixed && JSON.parse(fixed).ops[0]).toEqual({ op: "insert", parentId: null, block: { name: "stack", ref: "hero" } });
	});
});

describe("change_blocks: an empty page", () => {
	it("puts the first root block inside a new page shell, and the next one there too", async () => {
		const { result, getTree } = await change({
			blocks: [],
			ops: [
				{ op: "insert", parentId: null, block: { name: "stack", ref: "hero" } },
				{ op: "insert", parentId: null, block: { name: "paragraph" } },
			],
		});
		expect(result.ok).toBe(true);
		const tree = getTree();
		expect(tree).toHaveLength(1);
		expect(tree[0].name).toBe("core/page-shell");
		expect(tree[0].id).toMatch(UUID_PATTERN);
		expect(tree[0].children?.map((child) => [child.name, child.parentId])).toEqual([
			["core/stack", tree[0].id],
			["core/paragraph", tree[0].id],
		]);
		expect(result.text).toContain(`placed inside a new page shell (id ${tree[0].id}); every page has one`);
		expect(result.text).toContain(`hero=${tree[0].children?.[0].id}`);
	});
});

describe("change_blocks: the check after a change", () => {
	it("says the whole page is clean, so no check_page is needed", async () => {
		const { result } = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "intro", content: { value: "Hi" } }] });
		expect(result.text).toContain(PAGE_CLEAN_LINE);
	});

	it("does not call a page with phone warnings clean", async () => {
		const { result } = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "group", styles: { width: "1400px" } } }],
		});
		expect(result.ok).toBe(true);
		expect(result.text).toContain("Phone warnings for blocks you touched");
		expect(result.text).not.toContain(PAGE_CLEAN_LINE);
	});
});

describe("change_blocks: content fields", () => {
	it("refuses a field the block doesn't have, and says where it belongs", async () => {
		const nested = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "icon", content: { iconName: "zap" } } }],
		});
		expect(nested.result.ok).toBe(false);
		expect(nested.writes).toHaveLength(0);
		expect(nested.result.text).toContain('"iconName" isn\'t a field of core/icon. Did you mean icon.iconName? Send {"icon": {"iconName": …}}.');
		expect(nested.result.text).toContain("Its content fields: icon (iconSet, iconName,");

		const style = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "title", content: { textAlign: "center" } }] });
		expect(style.result.text).toContain('"textAlign" isn\'t a field of core/heading. textAlign is a style: send it in styles, not content.');

		const alias = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "intro", content: { text: "Hi" } }] });
		expect(alias.result.text).toContain('"text" isn\'t a field of core/paragraph. Did you mean value?');

		const inside = await change({
			blocks: makeSamplePage(),
			ops: [{ op: "insert", parentId: "hero", block: { name: "icon", content: { icon: { iconSet: "lucide", name: "zap" } } } }],
		});
		expect(inside.result.text).toContain('"icon.name" isn\'t a field of core/icon. Did you mean icon.iconName?');
	});

	it("accepts the block's real fields, extras the editor reads, fields it already has, and any null", async () => {
		const page = makeSamplePage();
		const intro = findBlockById({ blocks: page, id: "intro" });
		if (intro) intro.content = { kind: "text", value: "Hello", oldThing: "kept" } as typeof intro.content;
		const { result, getTree } = await change({
			blocks: page,
			ops: [
				{ op: "insert", parentId: "hero", block: { name: "icon", content: { icon: { iconSet: "lucide", iconName: "zap" }, link: "/about" } } },
				{ op: "update", id: "title", content: { format: "html", value: "<em>Hi</em>" } },
				{ op: "update", id: "intro", content: { oldThing: "changed", gone: null } },
				{ op: "insert", parentId: "hero", block: { name: "input", content: { label: "Your email", helpText: "We reply in a day" } } },
			],
		});
		expect(result.ok).toBe(true);
		expect(findBlockById({ blocks: getTree(), id: "intro" })?.content).toMatchObject({ oldThing: "changed" });
	});
});

describe("change_blocks: fillBehind", () => {
	it("marks a layer of an overlay Stack as filling behind, when built with children or inserted later", async () => {
		const built = await change({
			blocks: makeSamplePage(),
			ops: [
				{
					op: "insert",
					parentId: "hero",
					block: {
						name: "stack",
						content: { stackType: "overlay" },
						children: [{ name: "image", fillBehind: true }, { name: "heading", content: { value: "Over the picture" } }],
					},
				},
			],
		});
		expect(built.result.ok).toBe(true);
		const layers = childrenOf(built.getTree(), "hero").at(-1)?.children ?? [];
		expect(layers[0].settings?.stackFillBehind).toBe(true);
		expect(layers[1].settings?.stackFillBehind).toBeUndefined();

		const later = await change({ blocks: overlayHero(), ops: [{ op: "insert", parentId: "layers", index: 0, block: { name: "video", fillBehind: true } }] });
		expect(childrenOf(later.getTree(), "layers")[0].settings?.stackFillBehind).toBe(true);
	});

	it("switches it on an existing layer, and refuses it outside an overlay Stack", async () => {
		const page = overlayHero();
		const on = await change({
			blocks: page,
			ops: [
				{ op: "insert", parentId: "layers", block: { name: "image", ref: "pic" } },
				{ op: "update", id: "pic", fillBehind: true },
			],
		});
		expect(childrenOf(on.getTree(), "layers")[0].settings?.stackFillBehind).toBe(true);

		const outside = await change({ blocks: makeSamplePage(), ops: [{ op: "update", id: "intro", fillBehind: true }] });
		expect(outside.result.text).toContain("fillBehind only works on a layer directly inside a Stack whose stackType is overlay.");
		expect(outside.writes).toHaveLength(0);
	});
});

const pageWithColumns = (columnLayout?: Array<{ columnId: string; width: string; blockIds: string[] }>, children: string[] = []) =>
	makeSamplePage().map((shell) => ({
		...shell,
		children: [
			...(shell.children ?? []),
			{
				...makeBlock({ name: "core/columns", id: "cols", children: children.map((id) => makeBlock({ name: "core/group", id })) }),
				settings: columnLayout ? { columnLayout } : {},
			},
		],
	}));

const layoutOf = (tree: Parameters<typeof findBlockById>[0]["blocks"]) =>
	(findBlockById({ blocks: tree, id: "cols" })?.settings?.columnLayout ?? []) as Array<{ columnId: string; width: string; blockIds: string[] }>;

describe("change_blocks: blocks added to an existing Columns block", () => {
	it("gives each new child its own equal column, in one call or across calls", async () => {
		const first = await change({
			blocks: pageWithColumns(),
			ops: [
				{ op: "insert", parentId: "cols", block: { name: "group", ref: "a" } },
				{ op: "insert", parentId: "cols", block: { name: "group", ref: "b" } },
			],
		});
		const ids = childrenOf(first.getTree(), "cols").map((child) => child.id);
		expect(layoutOf(first.getTree()).map(({ width, blockIds }) => [width, blockIds])).toEqual([
			["50.00%", [ids[0]]],
			["50.00%", [ids[1]]],
		]);

		const second = await change({ blocks: first.getTree(), ops: [{ op: "insert", parentId: "cols", block: { name: "group" } }] });
		const layout = layoutOf(second.getTree());
		expect(layout.map((column) => column.width)).toEqual(["33.33%", "33.33%", "33.33%"]);
		expect(layout.slice(0, 2).map((column) => column.columnId)).toEqual(layoutOf(first.getTree()).map((column) => column.columnId));
	});

	it("fills a person's empty columns first and keeps their widths", async () => {
		const { getTree } = await change({
			blocks: pageWithColumns(
				[
					{ columnId: "wide", width: "60%", blockIds: ["kept"] },
					{ columnId: "narrow", width: "40%", blockIds: [] },
				],
				["kept"],
			),
			ops: [{ op: "insert", parentId: "cols", block: { name: "paragraph" } }],
		});
		const added = childrenOf(getTree(), "cols")[1].id;
		expect(layoutOf(getTree())).toEqual([
			{ columnId: "wide", width: "60%", blockIds: ["kept"] },
			{ columnId: "narrow", width: "40%", blockIds: [added] },
		]);
	});

	it("drops a removed child from its column, and leaves Columns the change did not touch alone", async () => {
		const removed = await change({
			blocks: pageWithColumns(
				[
					{ columnId: "one", width: "50%", blockIds: ["x"] },
					{ columnId: "two", width: "50%", blockIds: ["y"] },
				],
				["x", "y"],
			),
			ops: [{ op: "delete", id: "y" }],
		});
		expect(layoutOf(removed.getTree())).toEqual([
			{ columnId: "one", width: "50%", blockIds: ["x"] },
			{ columnId: "two", width: "50%", blockIds: [] },
		]);

		const untouched = await change({ blocks: pageWithColumns(undefined, ["p", "q"]), ops: [{ op: "update", id: "intro", content: { value: "Hi" } }] });
		expect(findBlockById({ blocks: untouched.getTree(), id: "cols" })?.settings).toEqual({});
	});
});

describe("change_blocks: ops sent as text", () => {
	it("tells the model exactly what to send when ops is not a list", async () => {
		const { result } = await change({ blocks: makeSamplePage(), ops: "[{" as unknown as object[] });
		expect(result.ok).toBe(false);
		expect(result.text).toContain("ops must be a list of op objects. If you can only send it as text, it must be valid JSON");
	});
});

describe("change_blocks: keys a block doesn't have", () => {
	it("says which keys a block has and that fields go inside content", async () => {
		const { result } = await change({ blocks: makeSamplePage(), ops: [{ op: "insert", parentId: "hero", block: { name: "button", url: "/contact" } }] });
		expect(result.ok).toBe(false);
		expect(result.text).toContain("A block has only name, ref, label, content, styles, fillBehind and children. Fields such as value, url or level go inside content.");
	});
});

describe("change_blocks: inline markup in text", () => {
	it("marks a heading or paragraph whose text has inline tags as html, so the tags don't show as text", async () => {
		const { getTree } = await change({
			blocks: makeSamplePage(),
			ops: [
				{ op: "insert", parentId: "hero", block: { name: "paragraph", ref: "price", content: { value: "<strong>$19</strong> a month" } } },
				{ op: "update", id: "title", content: { value: "Plain words" } },
				{ op: "update", id: "intro", content: { value: 'Read <a href="/about">more</a>' } },
			],
		});
		const hero = childrenOf(getTree(), "hero");
		expect(hero.at(-1)?.content).toMatchObject({ value: "<strong>$19</strong> a month", format: "html" });
		expect(findBlockById({ blocks: getTree(), id: "title" })?.content).not.toHaveProperty("format");
		expect(findBlockById({ blocks: getTree(), id: "intro" })?.content).toMatchObject({ format: "html" });
	});
});
