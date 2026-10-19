import { describe, expect, it } from "vitest";
import {
	buildBlockFromSpec,
	checkPage,
	createPageTools,
	outlinePage,
	PAGE_DESIGN_GUIDE,
	type PageToolContext,
	type TreeChange,
	patchBlockTree,
	validateBlockTree,
} from "../index.js";
import { createBlocksBuilder } from "../blocks/build-block.js";
import { runPatchBlocks } from "../blocks/run-patch-blocks.js";
import type { BlockConfig } from "../types/domain.js";
import { sdkOk } from "../client/sdk-result.js";

const blocks = createBlocksBuilder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const buildPage = (): BlockConfig[] => [
	blocks.fromName("core/page-shell", {
		id: "shell",
		children: [
			blocks.heading({ id: "title", text: "Welcome", level: 1 }),
			blocks.paragraph({ id: "intro", text: "Hello there" }),
		],
	}),
];

const createContext = (initial: BlockConfig[]) => {
	let tree = structuredClone(initial);
	const writes: TreeChange[] = [];
	const ctx: PageToolContext = {
		readTree: async () => structuredClone(tree),
		writeTree: async (change) => {
			writes.push(change);
			tree = structuredClone(change.blocks);
			return { ok: true };
		},
		newId: () => crypto.randomUUID(),
	};
	return { ctx, writes, getTree: () => tree };
};

describe("the agent helpers as the SDK exports them", () => {
	it("outlines a page built with the builders", () => {
		expect(outlinePage({ blocks: buildPage() }).split("\n")).toEqual([
			"page-shell id=shell",
			'  heading id=title level=1 text="Welcome"',
			'  paragraph id=intro text="Hello there"',
		]);
	});

	it("checks a page built with the builders and reports a phone problem as a warning", () => {
		expect(checkPage({ blocks: buildPage() })).toEqual({ ok: true, problems: [] });
		const wide = [blocks.group({ settings: { styles: { width: "900px" } } })];
		const result = checkPage({ blocks: wide });
		expect(result.ok).toBe(true);
		expect(result.problems.map((problem) => problem.kind)).toEqual(["phone"]);
	});

	it("builds a block from a plain description", () => {
		const built = buildBlockFromSpec({
			spec: { name: "core/stack", children: [{ name: "core/heading", content: { value: "Hi", level: 2 } }] },
			parentId: null,
			newId: () => crypto.randomUUID(),
		});
		expect(built.ok).toBe(true);
		if (!built.ok) return;
		expect(built.value.children?.[0].content).toMatchObject({ kind: "text", value: "Hi", level: 2 });
		expect(validateBlockTree([built.value]).ok).toBe(true);
		expect(buildBlockFromSpec({ spec: { name: "core/nope" as never }, parentId: null, newId: () => "x" }).ok).toBe(false);
	});

	it("exports the design guide", () => {
		expect(PAGE_DESIGN_GUIDE).toContain("# Building NextPress pages");
	});
});

describe("patchBlockTree replace, as the SDK exports it", () => {
	it("swaps a block in place", () => {
		const page = buildPage();
		const result = patchBlockTree({
			blocks: page,
			ops: [{ op: "replace", id: "title", block: blocks.heading({ id: "title2", text: "New", level: 1 }) }],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.blocks[0].children?.map((child) => child.id)).toEqual(["title2", "intro"]);
		expect(result.summary).toEqual({ inserted: [], updated: [], deleted: [], moved: [], replaced: ["title2"] });
	});

	it("runs through runPatchBlocks, the way the MCP patch_page_blocks tool saves", async () => {
		const page = buildPage();
		let saved: BlockConfig[] = [];
		const result = await runPatchBlocks({
			id: "page-1",
			expectedVersion: 3,
			label: "pages.patchBlocks",
			ops: [
				{ op: "replace", id: "intro", block: blocks.paragraph({ id: "intro-new", text: "Fresh" }) },
				{ op: "update", id: "title", set: { label: "Main" } },
			],
			get: async () => ({ blocks: page, version: 3 }),
			update: async ({ blocks: next }) => {
				saved = next;
				return sdkOk({ blocks: next, version: 4 });
			},
		});
		expect(result.isOk).toBe(true);
		expect(saved[0].children?.map((child) => child.id)).toEqual(["title", "intro-new"]);
		expect(saved[0].children?.every((child) => child.parentId === "shell")).toBe(true);
		if (result.isOk) expect(result.value.summary.replaced).toEqual(["intro-new"]);
	});
});

describe("createPageTools as the SDK exports it", () => {
	it("lets an agent read, change and check a page built with the builders", async () => {
		const { ctx, writes, getTree } = createContext(buildPage());
		const tools = createPageTools(ctx);
		const call = (name: string, input: Record<string, unknown> = {}) => {
			const tool = tools.find((candidate) => candidate.name === name);
			if (!tool) throw new Error(`no tool ${name}`);
			return tool.run(input);
		};

		const outline = await call("get_page_outline");
		expect(outline.text).toContain("heading id=title level=1");

		const change = await call("change_blocks", {
			ops: [
				{ op: "insert", parentId: null, block: { name: "core/form", content: { name: "Waitlist" } } },
				{ op: "update", id: "title", content: { value: "Join us" } },
			],
		});
		expect(change.ok).toBe(true);
		expect(writes).toHaveLength(1);
		const shellChildren = getTree()[0].children ?? [];
		expect(shellChildren.map((child) => child.name)).toEqual(["core/heading", "core/paragraph", "core/form"]);
		expect(shellChildren[2].id).toMatch(UUID);
		expect(shellChildren[2].children).toHaveLength(4);
		expect(shellChildren[0].content).toMatchObject({ value: "Join us" });

		expect((await call("check_page")).text).toContain("clean");
		expect(validateBlockTree(getTree()).ok).toBe(true);
	});
});
