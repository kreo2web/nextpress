import { describe, expect, it } from "vitest";
import { buildBlocksFromSpecs } from "./build-blocks.js";

describe("buildBlocksFromSpecs", () => {
	it("builds nested blocks from the same shape change_page_blocks takes, short names included", () => {
		const blocks = buildBlocksFromSpecs([
			{
				name: "core/container",
				children: [
					{ name: "core/heading", content: { value: "Hi", level: 1 } },
					{ name: "core/paragraph", content: { value: "Body" } },
				],
			},
		]);

		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("core/container");
		expect(blocks[0].children?.map((child) => [child.name, child.parentId])).toEqual([
			["core/heading", blocks[0].id],
			["core/paragraph", blocks[0].id],
		]);
		expect(blocks[0].children?.[0]?.content).toMatchObject({ kind: "text", value: "Hi", level: 1 });
	});

	it("gives Columns one equal column per child, as on a page", () => {
		const [columns] = buildBlocksFromSpecs([{ name: "core/columns", children: [{ name: "core/group" }, { name: "core/group" }] }]);
		expect(columns.settings?.columnLayout).toHaveLength(2);
	});

	it("names the block that is wrong", () => {
		expect(() => buildBlocksFromSpecs([{ name: "core/heading" }, { name: "core/icon", content: { iconName: "zap" } }])).toThrow(
			/^blocks\[1\]: core\/icon: "iconName" isn't a field of core\/icon\. Did you mean icon\.iconName\?/,
		);
	});
});
