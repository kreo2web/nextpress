import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { buildTemplatePartBlock, flattenBlockTree } from "@shared/template-parts";
import {
	resolveTemplateParts,
	templatePartsStamp,
	type LoadedTemplate,
} from "../lib/template-parts/resolve-template-parts";

const SITE = "site-a";

const text = (id: string, value: string, parentId: string | null = null): BlockConfig => ({
	id,
	name: "core/paragraph",
	type: "block",
	parentId,
	content: { kind: "text", value },
});

const shell = (id: string, children: BlockConfig[]): BlockConfig => ({
	id,
	name: "core/page-shell",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: {} },
	children: children.map((child) => ({ ...child, parentId: id })),
});

const part = (id: string, templateId: string): BlockConfig => buildTemplatePartBlock({ id, templateId });

const linkedTemplate = (
	id: string,
	blocks: BlockConfig[],
	options: { siteId?: string; updatedAt?: Date } = {},
): LoadedTemplate => ({
	id,
	other: { usage: "part", siteId: options.siteId ?? SITE },
	blocks,
	updatedAt: options.updatedAt ?? new Date("2026-10-01T10:00:00.000Z"),
});

const preDesignedTemplate = (id: string, blocks: BlockConfig[]): LoadedTemplate => ({
	id,
	other: {},
	blocks,
	updatedAt: new Date("2026-10-01T10:00:00.000Z"),
});

const fakeTemplates = (rows: LoadedTemplate[]) => {
	const lookups: string[] = [];
	return {
		lookups,
		loadTemplate: async (templateId: string) => {
			lookups.push(templateId);
			return rows.find((row) => row.id === templateId) ?? null;
		},
	};
};

const textsOf = (blocks: BlockConfig[]): string[] =>
	flattenBlockTree(blocks)
		.filter((block) => block.name === "core/paragraph")
		.map((block) => (block.content as { value: string }).value);

describe("resolveTemplateParts", () => {
	let warn: MockInstance<typeof console.warn>;

	/** The context object each "left out" warning carries. */
	const warnings = () => warn.mock.calls.map((call) => call[1] as Record<string, unknown>);

	beforeEach(() => {
		warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		warn.mockRestore();
	});

	it("returns the page unchanged and looks nothing up when it has no parts", async () => {
		const templates = fakeTemplates([]);
		const page = [shell("page-shell", [text("a", "Plain page")])];
		const result = await resolveTemplateParts({
			blocks: page,
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});
		expect(result).toEqual({ blocks: page, usedTemplates: [] });
		expect(templates.lookups).toEqual([]);
	});

	it("swaps a part for the template's blocks and drops the template's page shell", async () => {
		const templates = fakeTemplates([
			linkedTemplate("header", [shell("tpl-shell", [text("h", "Site header")])]),
		]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [text("body", "Body"), part("p1", "header")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		const pageShell = result.blocks[0];
		expect(pageShell.children?.map((block) => block.name)).toEqual(["core/paragraph", "core/paragraph"]);
		expect(pageShell.children?.[1]).toMatchObject({ parentId: "page-shell" });
		expect(textsOf(result.blocks)).toEqual(["Body", "Site header"]);
		expect(flattenBlockTree(result.blocks).some((block) => block.name === "core/page-shell" && block.id !== "page-shell")).toBe(false);
		expect(flattenBlockTree(result.blocks).some((block) => block.name === "core/template-part")).toBe(false);
	});

	it("gives each copy of the same template its own ids", async () => {
		const templates = fakeTemplates([linkedTemplate("footer", [text("f", "Footer note")])]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p1", "footer"), part("p2", "footer")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		const copies = flattenBlockTree(result.blocks).filter((block) => block.name === "core/paragraph");
		expect(copies.map((block) => (block.content as { value: string }).value)).toEqual(["Footer note", "Footer note"]);
		const ids = copies.map((block) => block.id);
		expect(new Set(ids).size).toBe(2);
		expect(ids).toEqual(["p1-1", "p2-1"]);
		expect(templates.lookups).toEqual(["footer"]);
	});

	it("shows nested templates up to three levels and leaves out the fourth", async () => {
		const templates = fakeTemplates([
			linkedTemplate("level-1", [text("one", "Level one"), part("to-2", "level-2")]),
			linkedTemplate("level-2", [text("two", "Level two"), part("to-3", "level-3")]),
			linkedTemplate("level-3", [text("three", "Level three"), part("to-4", "level-4")]),
			linkedTemplate("level-4", [text("four", "Level four")]),
		]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("top", "level-1")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual(["Level one", "Level two", "Level three"]);
		expect(warnings()).toEqual([
			expect.objectContaining({ pageId: "page-1", templateId: "level-4", reason: "too-deep" }),
		]);
	});

	it("does not loop when a template points back at itself", async () => {
		const templates = fakeTemplates([
			linkedTemplate("loop", [text("again", "Once"), part("inner", "loop")]),
		]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("top", "loop")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual(["Once"]);
		expect(warnings()).toEqual([
			expect.objectContaining({ templateId: "loop", reason: "self-reference" }),
		]);
	});

	it("refuses a template that belongs to another site", async () => {
		const templates = fakeTemplates([
			linkedTemplate("other-header", [text("x", "Not yours")], { siteId: "site-b" }),
		]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [text("body", "Body"), part("p", "other-header")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual(["Body"]);
		expect(result.usedTemplates).toEqual([]);
		expect(warnings()).toEqual([
			expect.objectContaining({ pageId: "page-1", templateId: "other-header", reason: "other-site" }),
		]);
	});

	it("refuses a pre-designed block referenced by a part", async () => {
		const templates = fakeTemplates([preDesignedTemplate("starter", [text("s", "Starter")])]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p", "starter")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual([]);
		expect(warnings()).toEqual([expect.objectContaining({ templateId: "starter", reason: "not-a-part" })]);
	});

	it("refuses every part when the page has no site", async () => {
		const templates = fakeTemplates([linkedTemplate("header", [text("h", "Header")])]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p", "header")])],
			siteId: null,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual([]);
		expect(warnings()).toEqual([expect.objectContaining({ reason: "other-site" })]);
	});

	it("drops a part whose template is gone, logging the page and template ids", async () => {
		const templates = fakeTemplates([]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [text("body", "Still here"), part("p", "deleted-header")])],
			siteId: SITE,
			pageId: "page-9",
			loadTemplate: templates.loadTemplate,
		});

		expect(textsOf(result.blocks)).toEqual(["Still here"]);
		expect(warnings()).toEqual([
			expect.objectContaining({
				atFunction: "resolveTemplateParts",
				pageId: "page-9",
				templateId: "deleted-header",
				reason: "missing",
			}),
		]);
	});

	it("drops a part whose lookup fails, and logs the error with the ids", async () => {
		const failure = new Error("connection reset");
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p", "header")])],
			siteId: SITE,
			pageId: "page-2",
			loadTemplate: async () => {
				throw failure;
			},
		});

		expect(result.blocks[0].children).toEqual([]);
		expect(warnings()).toEqual([
			expect.objectContaining({ pageId: "page-2", templateId: "header", reason: "load-failed", error: failure }),
		]);
	});

	it("drops a part that has no template chosen yet", async () => {
		const templates = fakeTemplates([]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [{ ...part("empty", ""), content: { kind: "structured", data: { templateId: "" } } }])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(result.blocks[0].children).toEqual([]);
		expect(templates.lookups).toEqual([]);
		expect(warnings()).toEqual([expect.objectContaining({ reason: "no-template" })]);
	});

	it("loads a template once when the page uses it twice", async () => {
		const templates = fakeTemplates([linkedTemplate("header", [text("h", "Header")])]);
		await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p1", "header"), part("p2", "header")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});
		expect(templates.lookups).toEqual(["header"]);
	});

	it("reports every linked template it showed, with its update time, sorted by id", async () => {
		const updated = new Date("2026-10-02T08:30:00.000Z");
		const templates = fakeTemplates([
			linkedTemplate("header", [text("h", "Header")], { updatedAt: updated }),
			linkedTemplate("footer", [part("nested", "header")], { updatedAt: new Date("2026-10-01T00:00:00.000Z") }),
		]);
		const result = await resolveTemplateParts({
			blocks: [shell("page-shell", [part("p1", "footer")])],
			siteId: SITE,
			pageId: "page-1",
			loadTemplate: templates.loadTemplate,
		});

		expect(result.usedTemplates).toEqual([
			{ id: "footer", updatedAt: new Date("2026-10-01T00:00:00.000Z").getTime() },
			{ id: "header", updatedAt: updated.getTime() },
		]);
	});
});

describe("templatePartsStamp", () => {
	it("is empty when the page shows no linked templates", () => {
		expect(templatePartsStamp([])).toBe("");
	});

	it("changes when a shown template is updated", () => {
		const before = templatePartsStamp([{ id: "header", updatedAt: 1000 }]);
		const after = templatePartsStamp([{ id: "header", updatedAt: 2000 }]);
		expect(before).not.toBe(after);
	});
});
