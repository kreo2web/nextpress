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

type Shape = { name: string; content: BlockConfig["content"]; children?: Shape[] };
const shape = (blocks: BlockConfig[]): Shape[] =>
	blocks.map((block) => ({ name: block.name, content: block.content, ...(block.children ? { children: shape(block.children) } : {}) }));

/** One page that nests every container with the blocks people put in them: tabs holding code and a callout, steps holding a list, cards with text, an update holding a diagram. */
const NESTED_PAGE = [
	"<Tabs>",
	"",
	'<Tab title="npm">',
	"",
	"```bash",
	"npm install nextpress",
	"```",
	"",
	'<Callout type="tip">',
	"",
	"Use pnpm too.",
	"",
	"</Callout>",
	"",
	"</Tab>",
	"",
	"</Tabs>",
	"",
	'<Steps marker="dot">',
	"",
	'<Step title="Install">',
	"",
	"- one",
	"- two",
	"",
	"</Step>",
	"",
	"</Steps>",
	"",
	'<Cards cols="2">',
	"",
	'<Card title="Fast">',
	"",
	"Quick to start.",
	"",
	"</Card>",
	"",
	"</Cards>",
	"",
	'<Update label="v1.4.2" description="Fixes">',
	"",
	"```mermaid",
	"flowchart LR",
	"  A --> B",
	"```",
	"",
	"</Update>",
	"",
].join("\n");

describe("a page that nests containers and the blocks inside them", () => {
	it("reads and writes back to the same MDX text", () => {
		const blocks = toBlocks(NESTED_PAGE);
		const written = blocksToMdx(blocks);
		expect(written.skipped).toEqual([]);
		expect(written.mdx).toBe(NESTED_PAGE);
	});

	it("gives the same block tree when written and read again, ignoring ids", () => {
		const blocks = toBlocks(NESTED_PAGE);
		expect(shape(toBlocks(blocksToMdx(blocks).mdx))).toEqual(shape(blocks));
	});

	it("nests each block under its container", () => {
		const [tabs, steps, grid, update] = toBlocks(NESTED_PAGE);
		expect(tabs.name).toBe("core/tabs");
		expect(tabs.children?.[0].name).toBe("core/tab");
		expect(tabs.children?.[0].children?.map((child) => child.name)).toEqual(["core/code", "docs/callout"]);
		expect(steps.name).toBe("core/steps");
		expect(steps.children?.[0].children?.map((child) => child.name)).toEqual(["docs/list"]);
		expect(grid.name).toBe("core/grid");
		expect(grid.children?.[0].name).toBe("core/card");
		expect(grid.children?.[0].children?.map((child) => child.name)).toEqual(["docs/text"]);
		expect(update.name).toBe("docs/update");
		expect(update.children?.map((child) => child.name)).toEqual(["docs/diagram"]);
	});

	it("gives every nested block the parent it sits in", () => {
		const check = (blocks: BlockConfig[], parentId: string | null): void => {
			for (const block of blocks) {
				expect(block.parentId).toBe(parentId);
				if (block.children) check(block.children, block.id);
			}
		};
		check(toBlocks(NESTED_PAGE), null);
	});
});
