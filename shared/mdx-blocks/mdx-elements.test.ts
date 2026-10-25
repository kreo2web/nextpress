import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { blocksToMdx, mdxToBlocks } from "./index.js";

const idMaker = (): (() => string) => {
	let count = 0;
	return () => `b${++count}`;
};

const toBlocks = (text: string): BlockConfig[] => {
	const result = mdxToBlocks({ text, newId: idMaker() });
	if (!result.ok) throw new Error(result.message);
	return result.blocks;
};

/** The block tree with ids, parents, styles and settings left out: what the page says, in order. */
type Shape = { name: string; content: BlockConfig["content"]; children?: Shape[] };
const shape = (blocks: BlockConfig[]): Shape[] =>
	blocks.map((block) => ({ name: block.name, content: block.content, ...(block.children ? { children: shape(block.children) } : {}) }));

/** The structured content a block holds, typed as the block type itself types it. */
type StructuredData = Extract<NonNullable<BlockConfig["content"]>, { kind: "structured" }>["data"];
const dataOf = (block: BlockConfig): StructuredData => (block.content?.kind === "structured" ? block.content.data : {});

/** Each element in the spelling NextPress writes it, with the block(s) it reads as. */
const ELEMENTS: Array<{ element: string; mdx: string; blocks: string[] }> = [
	{ element: "heading", mdx: "## Install the CLI\n", blocks: ["docs/heading"] },
	{ element: "paragraph", mdx: "Plain **words**, *styles* and [a link](https://example.com).\n", blocks: ["docs/text"] },
	{ element: "bullet list", mdx: "- one\n- two\n  - nested\n", blocks: ["docs/list"] },
	{ element: "callout", mdx: '<Callout type="warning" title="Back up first">\n\nCopy the uploads folder.\n\n</Callout>\n', blocks: ["docs/callout"] },
	{
		element: "code group",
		mdx: '<CodeGroup>\n\n```bash title="npm"\nnpm install nextpress\n```\n\n```bash title="pnpm"\npnpm add nextpress\n```\n\n</CodeGroup>\n',
		blocks: ["docs/code-group"],
	},
	{
		element: "file tree",
		mdx: "<FileTree>\n\n- src/\n  - app.ts *  # the entry point\n  - routes/\n    - index.ts\n- package.json\n\n</FileTree>\n",
		blocks: ["docs/file-tree"],
	},
	{
		element: "parameters",
		mdx: '<Param name="limit" type="number" default="20">How many results.</Param>\n<Param name="siteId" type="string" required>The site.</Param>\n',
		blocks: ["docs/params"],
	},
	{ element: "example", mdx: "<Example>\n\n```ts\nconst a = 1\n```\n\nWhat it makes.\n\n</Example>\n", blocks: ["docs/example"] },
	{ element: "code block", mdx: '```ts {2,4-6} title="app.ts" showLineNumbers\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\n```\n', blocks: ["core/code"] },
	{ element: "diagram", mdx: '```mermaid title="Flow"\nflowchart LR\n  A --> B\n```\n', blocks: ["docs/diagram"] },
	{
		element: "tabs",
		mdx: '<Tabs>\n\n<Tab title="npm">\n\n```bash\nnpm install nextpress\n```\n\n</Tab>\n\n<Tab title="yarn">\n\nUse yarn.\n\n</Tab>\n\n</Tabs>\n',
		blocks: ["core/tabs"],
	},
	{
		element: "steps",
		mdx: '<Steps marker="dot">\n\n<Step title="Install" icon="rocket">\n\n- one\n- two\n\n</Step>\n\n</Steps>\n',
		blocks: ["core/steps"],
	},
	{ element: "cards", mdx: '<Cards cols="2">\n\n<Card title="Fast" href="/start">\n\nQuick to start.\n\n</Card>\n\n</Cards>\n', blocks: ["core/grid"] },
	{
		element: "accordion",
		mdx: '<Accordion title="Question one">\n\nAnswer one.\n\n</Accordion>\n\n<Accordion title="Question two">\n\nAnswer two.\n\n</Accordion>\n',
		blocks: ["core/accordion"],
	},
	{ element: "table", mdx: "| Name | Type |\n| --- | --- |\n| limit | number |\n", blocks: ["core/table"] },
	{ element: "image", mdx: '![Alt text](/uploads/a.png "Title")\n', blocks: ["core/image"] },
	{ element: "separator", mdx: "---\n", blocks: ["core/separator"] },
	{ element: "quote", mdx: "> A plain quote.\n", blocks: ["core/quote"] },
	{ element: "changelog entry", mdx: '<Update label="October 2026" description="Two things">\n\nBody text.\n\n</Update>\n', blocks: ["docs/update"] },
];

describe("MDX element → block → MDX, one per element", () => {
	it.each(ELEMENTS)("$element reads as $blocks and writes back as the same text", ({ mdx, blocks }) => {
		const read = toBlocks(mdx);
		expect(read.map((block) => block.name)).toEqual(blocks);
		expect(blocksToMdx(read)).toEqual({ mdx, skipped: [] });
	});

	it.each(ELEMENTS)("$element: blocks → MDX → blocks gives the same block tree, ignoring ids", ({ mdx }) => {
		const read = toBlocks(mdx);
		const written = blocksToMdx(read);
		expect(written.skipped).toEqual([]);
		expect(shape(toBlocks(written.mdx))).toEqual(shape(read));
	});
});

describe("the spellings each element reads", () => {
	it.each([
		["Note", "note"],
		["Tip", "tip"],
		["Warning", "warning"],
		["Danger", "danger"],
		["Info", "note"],
		["Check", "success"],
	])("<%s> is a callout of type %s, written back as <Callout type=…>", (tag, type) => {
		const [block] = toBlocks(`<${tag}>\n\nText.\n\n</${tag}>\n`);
		expect(block.name).toBe("docs/callout");
		expect(dataOf(block).type).toBe(type);
		expect(blocksToMdx([block]).mdx).toBe(`<Callout type="${type}">\n\nText.\n\n</Callout>\n`);
	});

	it("reads a code fence's language, title, marked lines and line numbers", () => {
		const [block] = toBlocks('```ts {2,4-6} title="app.ts" showLineNumbers\nconst a = 1\n```\n');
		expect(dataOf(block)).toMatchObject({ content: "const a = 1", language: "ts", title: "app.ts", highlightLines: "2,4-6", showLineNumbers: true });
	});

	it("reads a single-quoted fence title, and a title holding double quotes", () => {
		const [block] = toBlocks("```ts title='say \"hi\"'\nx\n```\n");
		expect(dataOf(block)).toMatchObject({ title: 'say "hi"' });
	});

	it("reads a diagram's Mermaid text and its title as the caption", () => {
		const [block] = toBlocks('```mermaid title="Flow"\nflowchart LR\n  A --> B\n```\n');
		expect(dataOf(block)).toEqual({ code: "flowchart LR\n  A --> B", caption: "Flow" });
	});

	it("reads a file tree's lines (highlight mark and note kept, nesting as indentation)", () => {
		const [block] = toBlocks("<FileTree>\n\n- src/\n  - app.ts *  # the entry point\n- package.json\n\n</FileTree>\n");
		expect(dataOf(block).tree).toBe("src/\n  app.ts *  # the entry point\npackage.json");
	});

	it("reads parameters with their type, default, required flag and description", () => {
		const [block] = toBlocks('<Param name="limit" type="number" default="20">How many results.</Param>\n<Param name="siteId" required>The site.</Param>\n');
		expect(block.name).toBe("docs/params");
		expect(dataOf(block).items).toEqual([
			{ name: "limit", type: "number", default: "20", required: false, description: "How many results." },
			{ name: "siteId", type: "", default: "", required: true, description: "The site." },
		]);
	});

	it("reads a table's header and body cells, and writes them back in GFM", () => {
		const text = "| Name | Type |\n| --- | --- |\n| limit | number |\n| page | number |\n";
		const [block] = toBlocks(text);
		expect(dataOf(block).head).toEqual([{ cells: [{ content: "Name", tag: "th" }, { content: "Type", tag: "th" }] }]);
		expect(dataOf(block).body).toHaveLength(2);
		expect(blocksToMdx([block]).mdx).toBe(text);
	});

	it("reads a steps' marker and each step's title and icon", () => {
		const [steps] = toBlocks('<Steps marker="dot">\n\n<Step title="Install" icon="rocket">\n\nDo it.\n\n</Step>\n\n</Steps>\n');
		expect(dataOf(steps).marker).toBe("dot");
		expect(steps.children?.[0].name).toBe("core/step");
		expect(dataOf(steps.children?.[0] ?? steps)).toMatchObject({ title: "Install", icon: { iconSet: "lucide", iconName: "rocket" } });
	});

	it("reads a card's columns, title and link (whole-card link named by its title)", () => {
		const [grid] = toBlocks('<Cards cols="3">\n\n<Card title="Fast" href="/start">\n\nQuick.\n\n</Card>\n\n</Cards>\n');
		expect(dataOf(grid).columns).toBe(3);
		expect(dataOf(grid.children?.[0] ?? grid)).toMatchObject({ title: "Fast", link: "/start", linkLabel: "Fast" });
	});

	it("reads an update's label and description, and its blocks as children", () => {
		const [update] = toBlocks('<Update label="v1.4.2" description="Fixes">\n\n```mermaid\nflowchart LR\n```\n\n</Update>\n');
		expect(dataOf(update)).toEqual({ label: "v1.4.2", description: "Fixes" });
		expect(update.children?.map((child) => child.name)).toEqual(["docs/diagram"]);
	});

	it("reads an image's address, alt text and title", () => {
		const [image] = toBlocks('![Alt text](/uploads/a.png "Title")\n');
		expect(image.content).toMatchObject({ kind: "media", url: "/uploads/a.png", alt: "Alt text", title: "Title" });
	});

	it("keeps an example's layout", () => {
		const [example] = toBlocks('<Example layout="stacked">\n\n```ts\nx\n```\n\n</Example>\n');
		expect(dataOf(example).layout).toBe("stacked");
		expect(blocksToMdx([example]).mdx).toBe('<Example layout="stacked">\n\n```ts\nx\n```\n\n</Example>\n');
	});

	it("writes a diagram with its Mermaid text inside a mermaid fence", () => {
		const diagram = toBlocks("```mermaid\nflowchart LR\n  A --> B\n```\n")[0];
		expect(blocksToMdx([diagram]).mdx).toBe("```mermaid\nflowchart LR\n  A --> B\n```\n");
	});
});
