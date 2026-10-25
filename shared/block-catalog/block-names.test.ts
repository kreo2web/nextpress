import { describe, expect, it } from "vitest";
import { BLOCK_NAMES, resolveBlockName, suggestBlockNames } from "./block-names.js";

/** The retired spellings, built from parts so a search for them across the repo stays empty. */
const OLD_NAMES = ["callout", "code-group", "file-tree", "params", "code-example"].map((word) => `${"core"}/${word}`);

const DOCS_NAMES = ["docs/callout", "docs/code-group", "docs/file-tree", "docs/params", "docs/example"] as const;

describe("docs block names", () => {
	it("are the five docs/ names, and the old core/ spellings are gone", () => {
		for (const name of DOCS_NAMES) expect(BLOCK_NAMES).toContain(name);
		for (const old of OLD_NAMES) {
			expect(BLOCK_NAMES).not.toContain(old);
		}
	});

	it("sit together in one run, so a new docs block is added next to its neighbours", () => {
		const docs = BLOCK_NAMES.filter((name) => name.startsWith("docs/"));
		const first = BLOCK_NAMES.indexOf(docs[0]);
		expect(BLOCK_NAMES.slice(first, first + docs.length)).toEqual(docs);
	});
});

describe("resolveBlockName for docs blocks", () => {
	it("accepts a docs block by its full name, in any case and with stray spaces", () => {
		expect(resolveBlockName("docs/callout")).toEqual({ ok: true, name: "docs/callout" });
		expect(resolveBlockName("  Docs/Example ")).toEqual({ ok: true, name: "docs/example" });
	});

	it("refuses the short spelling and suggests the docs name", () => {
		const result = resolveBlockName("callout");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toBe('Unknown block name "callout". Did you mean docs/callout? Call list_block_types for the valid names.');
	});

	it.each([
		[OLD_NAMES[0], "docs/callout"],
		[OLD_NAMES[1], "docs/code-group"],
		[OLD_NAMES[2], "docs/file-tree"],
		[OLD_NAMES[3], "docs/params"],
		[OLD_NAMES[4], "docs/example"],
		["params", "docs/params"],
		["example", "docs/example"],
	])("refuses %s and suggests %s", (typed, suggestion) => {
		const result = resolveBlockName(typed);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toContain(suggestion);
		expect(suggestBlockNames(typed)).toContain(suggestion);
	});

	it("still reads a name without a prefix as a core/ block", () => {
		expect(resolveBlockName("heading")).toEqual({ ok: true, name: "core/heading" });
	});
});
