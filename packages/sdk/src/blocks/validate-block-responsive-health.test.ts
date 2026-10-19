import { describe, expect, it } from "vitest";
import * as sdk from "../index.js";
import type { BlockConfig } from "../types/domain.js";

const block = ({
	id,
	name,
	styles,
}: {
	id: string;
	name: string;
	styles: BlockConfig["styles"];
}): BlockConfig => ({
	id,
	name,
	type: "block",
	parentId: null,
	content: { kind: "structured", data: {} },
	styles,
});

describe("the phone check is the editor's", () => {
	it("exports the check and its fixer from the package entry", () => {
		expect(typeof sdk.validateBlockResponsiveHealth).toBe("function");
		expect(typeof sdk.applyResponsiveHealthFixes).toBe("function");
	});

	it("flags a fixed 1080px width and offers a fix", () => {
		const wide = block({ id: "wide", name: "core/video", styles: { width: "1080px" } });
		const result = sdk.validateBlockResponsiveHealth([wide]);
		expect(result.ok).toBe(false);
		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "WIDE_FIXED_WIDTH",
				blockId: "wide",
				fix: expect.objectContaining({ styles: { width: "100%", maxWidth: "1080px" } }),
			}),
		]);
	});

	it("fixes a 1080px width by turning it into a max width", () => {
		const wide = block({
			id: "wide",
			name: "core/video",
			styles: { width: "1080px", margin: "0" },
		});
		const fine = block({ id: "fine", name: "core/audio", styles: { width: "100%" } });
		const fixed = sdk.applyResponsiveHealthFixes([wide, fine]);

		expect(fixed.fixedCount).toBe(1);
		expect(fixed.blocks[0]?.styles).toEqual({ width: "100%", maxWidth: "1080px", margin: "0" });
		expect(fixed.blocks[1]).toBe(fine);
		expect(sdk.validateBlockResponsiveHealth(fixed.blocks).ok).toBe(true);
		expect(wide.styles).toEqual({ width: "1080px", margin: "0" });
	});

	it("fixes blocks nested inside a container", () => {
		const wide = block({ id: "inner", name: "core/video", styles: { width: "900px" } });
		const group: BlockConfig = {
			id: "group",
			name: "core/group",
			type: "container",
			parentId: null,
			content: { kind: "structured", data: {} },
			styles: { width: "100%" },
			children: [{ ...wide, parentId: "group" }],
		};
		const fixed = sdk.applyResponsiveHealthFixes([group]);
		expect(fixed.fixedCount).toBe(1);
		expect(fixed.blocks[0]?.children?.[0]?.styles).toEqual({ width: "100%", maxWidth: "900px" });
	});

	it("changes nothing when the tree is already fine", () => {
		const tree = [block({ id: "ok", name: "core/paragraph", styles: { width: "100%" } })];
		const fixed = sdk.applyResponsiveHealthFixes(tree);
		expect(fixed).toEqual({ blocks: tree, fixedCount: 0 });
	});
});
