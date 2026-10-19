import { describe, expect, it } from "vitest";
import { copyBrandLogoSchema } from "../schemas/brand-logo.js";
import {
	DEFAULT_TEMPLATE_ROOT,
	readTemplateRoot,
	TEMPLATE_ROOT_BLOCK_NAMES,
	TEMPLATE_ROOT_MESSAGE,
	type TemplateRootCandidate,
} from "../types/template-part-root.js";
import { isBlockName } from "./block-definitions.js";
import { createBlocksBuilder } from "./build-block.js";

type Node = TemplateRootCandidate & { id: string };

const node = (id: string, name: string, children?: Node[]): Node => ({
	id,
	name,
	...(children ? { children } : {}),
});

describe("template root rule", () => {
	it("allows eight layout and container blocks and starts from a group", () => {
		expect([...TEMPLATE_ROOT_BLOCK_NAMES]).toEqual([
			"core/group",
			"core/stack",
			"core/columns",
			"core/container",
			"core/header",
			"core/accordion",
			"core/popup",
			"core/form",
		]);
		expect(DEFAULT_TEMPLATE_ROOT).toBe("core/group");
		expect(TEMPLATE_ROOT_MESSAGE).toContain("A template is one layout block");
	});

	it.each([
		["one group", [node("a", "core/group", [node("h", "core/heading")])], "a"],
		["a page shell around one stack", [node("s", "core/page-shell", [node("a", "core/stack", [])])], "a"],
		[
			"nested page shells",
			[node("s", "core/page-shell", [node("t", "core/page-shell", [node("a", "core/form", [])])])],
			"a",
		],
	])("finds the root in %s", (_label, blocks, id) => {
		expect((readTemplateRoot(blocks) as Node | null)?.id).toBe(id);
	});

	it.each([
		["a loose heading", [node("h", "core/heading")]],
		["two roots", [node("a", "core/group", []), node("b", "core/columns", [])]],
		["a root and a loose block", [node("a", "core/group", []), node("h", "core/heading")]],
		["no blocks", []],
		["an empty page shell", [node("s", "core/page-shell", [])]],
		["an accordion item", [node("i", "core/accordion-item", [])]],
		["a template part", [node("p", "core/template-part")]],
	])("finds no root in %s", (_label, blocks) => {
		expect(readTemplateRoot(blocks)).toBeNull();
	});

	it.each([...TEMPLATE_ROOT_BLOCK_NAMES])("%s is a known block the builder can start from", (name) => {
		expect(isBlockName(name)).toBe(true);
		expect(createBlocksBuilder().fromName(name)).toMatchObject({ name, parentId: null });
	});
});

describe("brand logo address check", () => {
	it.each([
		"https://svgl.app/library/github.svg",
		"https://svgl.app/library/cursor_light.svg",
		"https://svgl.app/library/a-b.c_d.svg",
		// The address is normalized before it is compared: host case and the default port do not matter.
		"https://SVGL.app/library/github.svg",
		"https://svgl.app:443/library/github.svg",
	])("accepts %j", (url) => {
		expect(copyBrandLogoSchema.safeParse({ url }).success).toBe(true);
	});

	it.each([
		"https://SVGL.app/library/github.svg.evil",
		"https://svgl.app:8443/library/github.svg",
		"http://svgl.app/library/github.svg",
		"https://svgl.app.evil.com/library/github.svg",
		"https://evil.com/library/github.svg",
		"https://svgl.app/library/github.svg?x=1",
		"https://svgl.app/library/github.svg#top",
		"https://svgl.app/library/github.png",
		"https://svgl.app/library/a/b.svg",
		"https://svgl.app/library/.svg",
		"https://svgl.app/library/..%2Fgithub.svg",
		"https://svgl.app/other/github.svg",
		"https://svgl.app/library/",
		"//svgl.app/library/github.svg",
		"github",
		"",
	])("refuses %j with a plain message", (url) => {
		const result = copyBrandLogoSchema.safeParse({ url });
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].message).toContain("brand logo address from svgl.app");
	});
});
