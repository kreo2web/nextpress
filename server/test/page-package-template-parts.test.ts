import { describe, expect, it } from "vitest";
import type { pages } from "@shared/schema";
import type { BlockConfig } from "@shared/schema-types";
import { buildTemplatePartBlock } from "@shared/template-parts";
import { validateContentForSave } from "@shared/validate-content-save";
import type { Deps } from "../routes/shared/deps";
import { createPagePackageBuilder } from "../lib/page-transfer";
import { resolvePageTemplateParts } from "../lib/template-parts";

type PageRow = typeof pages.$inferSelect;

const SITE = "site-1";

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

describe("page package export with linked template parts", () => {
	const models = {
		templates: {
			findById: async (id: string) =>
				id === "footer-tpl"
					? {
							id,
							name: "Footer",
							type: "footer",
							other: { usage: "part", siteId: SITE },
							blocks: [shell("footer-shell", [text("note", "Copyright notice")])],
							updatedAt: new Date("2026-10-01T09:00:00.000Z"),
						}
					: undefined,
		},
	} as unknown as Pick<Deps["models"], "templates">;

	const builder = createPagePackageBuilder({
		listSiteMedia: async () => [],
		readActiveTheme: async () => null,
		resolvePageParts: async ({ siteId, pageId, blocks }) =>
			(await resolvePageTemplateParts({ models, siteId, pageId, blocks })).blocks,
		uploadDir: "/nonexistent-uploads-for-tests",
		uploadLimit: 1024,
		appVersion: "test",
	});

	it("replaces each part with the template's blocks so the file stands on its own", async () => {
		const page = {
			id: "page-1",
			siteId: SITE,
			title: "Contact",
			slug: "contact",
			featuredImage: null,
			other: {},
			blocks: [
				shell("page-shell", [
					text("intro", "Write to us"),
					buildTemplatePartBlock({ id: "footer-part", templateId: "footer-tpl" }),
				]),
			],
		} as unknown as PageRow;

		const pkg = await builder.buildForPage({ page, includeFiles: false });

		const serialized = JSON.stringify(pkg.blocks);
		expect(serialized).not.toContain("core/template-part");
		expect(serialized).toContain("Copyright notice");
		expect(serialized).toContain("Write to us");
		expect(pkg.blocks.filter((block) => block.name === "core/page-shell")).toHaveLength(1);
	});

	it("produces a file that passes the same save checks as a page", async () => {
		const page = {
			id: "page-2",
			siteId: SITE,
			title: "About",
			slug: "about",
			featuredImage: null,
			other: {},
			blocks: [shell("page-shell", [buildTemplatePartBlock({ id: "footer-part", templateId: "footer-tpl" })])],
		} as unknown as PageRow;

		const pkg = await builder.buildForPage({ page, includeFiles: false });
		const check = validateContentForSave({ blocks: pkg.blocks, other: {}, contentType: "page" });
		expect(check.ok).toBe(true);
	});
});
