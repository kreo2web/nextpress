import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types";
import { isTemplateRootBlockName, readTemplateRoot } from "./template-part-root";

const block = (id: string, name: string, children?: BlockConfig[]): BlockConfig => ({
	id,
	name,
	type: children ? "container" : "block",
	parentId: null,
	content: { kind: "structured", data: {} },
	...(children ? { children } : {}),
});

describe("a linked template is one layout or container block", () => {
	it("accepts any layout or container block, whatever it holds", () => {
		for (const name of ["core/group", "core/stack", "core/columns", "core/container", "core/header", "core/accordion", "core/popup", "core/form"]) {
			expect(isTemplateRootBlockName(name)).toBe(true);
		}
		const pricing = block("root", "core/columns", [block("a", "core/heading"), block("b", "core/button")]);
		expect(readTemplateRoot([pricing])?.id).toBe("root");
	});

	it("looks inside the editor's page shell", () => {
		const shell = block("shell", "core/page-shell", [block("root", "core/group", [block("h", "core/heading")])]);
		expect(readTemplateRoot([shell])?.id).toBe("root");
	});

	it("refuses loose blocks, two roots, an empty template, and the page shell itself", () => {
		expect(readTemplateRoot([block("h", "core/heading")])).toBeNull();
		expect(readTemplateRoot([block("a", "core/group", []), block("b", "core/group", [])])).toBeNull();
		expect(readTemplateRoot([])).toBeNull();
		expect(readTemplateRoot([block("shell", "core/page-shell", [])])).toBeNull();
		expect(isTemplateRootBlockName("core/page-shell")).toBe(false);
		expect(isTemplateRootBlockName("core/accordion-item")).toBe(false);
	});
});
