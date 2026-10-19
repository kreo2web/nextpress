import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { checkPage } from "./check-page.js";
import { makeBlock, makeParagraph, makeSamplePage } from "./test-support/memory-context.js";

const kinds = (blocks: BlockConfig[]) => checkPage({ blocks }).problems.map((problem) => problem.kind);

describe("checkPage", () => {
	it("passes a clean page", () => {
		expect(checkPage({ blocks: makeSamplePage() })).toEqual({ ok: true, problems: [] });
	});

	it("reports structure problems: unknown name, repeated id, children on a leaf, bad content", () => {
		const page = makeSamplePage();
		const broken: BlockConfig[] = [
			{ ...makeParagraph({ id: "a", text: "x" }), name: "core/imaginary" },
			makeParagraph({ id: "dup", text: "x" }),
			makeParagraph({ id: "dup", text: "y" }),
			{ ...makeParagraph({ id: "leaf", text: "x" }), children: [makeParagraph({ id: "kid", text: "z" })] },
			{ ...makeParagraph({ id: "shape", text: "x" }), content: { kind: "bogus" } as never },
		];
		const result = checkPage({ blocks: [...page, ...broken] });
		expect(result.ok).toBe(false);
		const structure = result.problems.filter((problem) => problem.kind === "structure");
		const messages = structure.map((problem) => problem.message).join("\n");
		expect(messages).toContain('Unknown block name "core/imaginary"');
		expect(messages).toContain('Duplicate block id "dup"');
		expect(messages).toContain('Leaf block "core/paragraph" cannot have children');
		expect(messages).toContain('Block "shape" has invalid content shape');
		expect(structure.every((problem) => typeof problem.fix === "string")).toBe(true);
		// The unknown name is one problem, not also a save problem.
		expect(result.problems.filter((problem) => problem.kind === "save")).toHaveLength(0);
	});

	it("accepts plain-object content with no kind (post/toc) and list content", () => {
		const blocks: BlockConfig[] = [
			makeBlock({ name: "post/toc", id: "toc" }),
			makeBlock({ name: "core/list", id: "list", content: { kind: "list", items: ["a"] } }),
		];
		expect(checkPage({ blocks })).toEqual({ ok: true, problems: [] });
	});

	it("reports what the server would refuse on save", () => {
		const badTag = makeBlock({ name: "core/group", id: "g", content: { kind: "structured", data: { tagName: "script" } } });
		const result = checkPage({ blocks: [badTag] });
		expect(result.ok).toBe(false);
		expect(result.problems).toEqual([
			{
				kind: "save",
				blockId: "g",
				message: "The server would refuse to save this page: Invalid group tagName: script",
				fix: "Fix or remove that block.",
			},
		]);

		const badIcon = makeBlock({ name: "core/icon", id: "ic", content: { kind: "structured", data: { icon: { iconSet: "lucide", iconName: "no-such-icon-at-all" } } } });
		expect(kinds([badIcon])).toEqual(["save"]);
	});

	it("does not change the blocks it was given", () => {
		const page = makeSamplePage();
		const copy = structuredClone(page);
		checkPage({ blocks: page });
		expect(page).toEqual(copy);
	});

	it("reports placement problems: a second page shell and a shell below the root", () => {
		const two = [makeBlock({ name: "core/page-shell", id: "s1" }), makeBlock({ name: "core/page-shell", id: "s2" })];
		const twoResult = checkPage({ blocks: two });
		expect(twoResult.ok).toBe(false);
		expect(twoResult.problems).toEqual([
			expect.objectContaining({ kind: "placement", blockId: "s2", message: "A page has only one page shell, and this is an extra one." }),
		]);

		const nested = [makeBlock({ name: "core/page-shell", id: "outer", children: [makeBlock({ name: "core/page-shell", id: "inner" })] })];
		const nestedResult = checkPage({ blocks: nested });
		expect(nestedResult.ok).toBe(false);
		const nestedPlacement = nestedResult.problems.filter((problem) => problem.kind === "placement");
		expect(nestedPlacement.map((problem) => problem.blockId)).toEqual(["inner"]);
		expect(nestedPlacement[0].message).toContain("can only sit at the page root");
	});

	it("reports phone problems as warnings that do not turn ok to false", () => {
		const wide = makeBlock({ name: "core/group", id: "wide", styles: { width: "900px" } });
		const result = checkPage({ blocks: [wide] });
		expect(result.ok).toBe(true);
		expect(result.problems).toHaveLength(1);
		expect(result.problems[0]).toMatchObject({ kind: "phone", blockId: "wide" });
		expect(result.problems[0].fix).toContain("Use max width instead");
	});

	it("lists structure, save, placement and phone problems in that order", () => {
		const blocks = [
			makeBlock({ name: "core/page-shell", id: "s1" }),
			makeBlock({ name: "core/page-shell", id: "s2" }),
			makeBlock({ name: "core/group", id: "g", content: { kind: "structured", data: { tagName: "script" } }, styles: { width: "900px" } }),
			makeParagraph({ id: "same", text: "x" }),
			makeParagraph({ id: "same", text: "y" }),
		];
		expect(kinds(blocks)).toEqual(["structure", "save", "placement", "phone"]);
	});

	it("checks posts too", () => {
		expect(checkPage({ blocks: [makeBlock({ name: "post/title", id: "t" })], contentType: "post" }).ok).toBe(true);
	});
});
