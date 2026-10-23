import { describe, expect, it } from "vitest";
import { balanceBrackets, repairChangeBlocksInput } from "./repair-change-blocks-input.js";

const insert = { op: "insert", parentId: null, block: { name: "core/heading", content: { value: "Hi" } } };

const repaired = async (input: object): Promise<unknown> => {
	const result = await repairChangeBlocksInput(JSON.stringify(input));
	return result === null ? null : JSON.parse(result);
};

describe("repairing change_blocks input from smaller models", () => {
	it("reads ops sent as a JSON string", async () => {
		expect(await repaired({ ops: JSON.stringify([insert]) })).toEqual({ ops: [insert] });
	});

	it("reads a block sent as a JSON string", async () => {
		expect(await repaired({ ops: [{ ...insert, block: JSON.stringify(insert.block) }] })).toEqual({ ops: [insert] });
	});

	it("moves styles and label left on the op into the block, and the block's own value wins", async () => {
		const result = await repaired({
			ops: [{ ...insert, label: "Top", styles: { gap: "1rem" }, block: { ...insert.block, label: "Kept" } }],
		});
		expect(result).toEqual({ ops: [{ ...insert, label: "Top", block: { ...insert.block, label: "Kept", styles: { gap: "1rem" } } }] });
	});

	it("gives up on text that isn't JSON even with its brackets put right, so the model is told and tries again", async () => {
		const unreadable = '[{"op": "delete" "id": "a"}]';
		expect(await repaired({ ops: unreadable })).toBeNull();
		expect(await repairChangeBlocksInput("{not json")).toBeNull();
	});

	it("gives up when the fixed input still isn't a valid change", async () => {
		expect(await repaired({ ops: [{ op: "insert", parentId: null }] })).toBeNull();
		expect(await repaired({ changes: [insert] })).toBeNull();
	});
});

describe("balanceBrackets", () => {
	it("drops a closer that closes nothing, adds the ones missing at the end, and leaves strings alone", () => {
		expect(balanceBrackets('[{"a": {"b": 1}}}, {"c": 2}]')).toBe('[{"a": {"b": 1}}, {"c": 2}]');
		expect(balanceBrackets('[{"a": [1, 2')).toBe('[{"a": [1, 2]}]');
		expect(balanceBrackets('{"text": "a } and ] and \\" {"}')).toBe('{"text": "a } and ] and \\" {"}');
	});

	it("lets the repair read the change a model really sent with one } too many", async () => {
		// Sent by MiniCPM-V-4.7 on 2026-10-22: one "}" too many after the update's styles.
		const ops =
			'[{"op": "update", "id": "hero", "styles": {"backgroundColor": "var(--npb-surface-raised)"}}}, {"op": "insert", "parentId": "shell", "index": 1, "block": {"name": "core/stack", "label": "Features Section", "children": [{"name": "heading", "content": {"value": "Why us"}}}, {"name": "paragraph"}]}}]';
		const fixed = await repairChangeBlocksInput(JSON.stringify({ ops }));
		expect(fixed && JSON.parse(fixed).ops).toEqual([
			{ op: "update", id: "hero", styles: { backgroundColor: "var(--npb-surface-raised)" } },
			{
				op: "insert",
				parentId: "shell",
				index: 1,
				block: { name: "core/stack", label: "Features Section", children: [{ name: "heading", content: { value: "Why us" } }, { name: "paragraph" }] },
			},
		]);
	});
});

describe("content fields left on a block", () => {
	it("moves them into content at every level, and the block's own content wins", async () => {
		// Seen 2026-10-22: a button's url next to its content, seven times in one run.
		const result = await repaired({
			ops: [
				{
					op: "insert",
					parentId: null,
					block: {
						name: "stack",
						children: [{ name: "button", content: { value: "Choose", url: "/kept" }, url: "/contact", level: 3 }, { name: "image", url: "/a.png" }],
					},
				},
			],
		});
		expect((result as { ops: Array<{ block: { children: unknown[] } }> } | null)?.ops[0].block.children).toEqual([
			{ name: "button", content: { value: "Choose", url: "/kept", level: 3 } },
			{ name: "image", content: { url: "/a.png" } },
		]);
	});
});
