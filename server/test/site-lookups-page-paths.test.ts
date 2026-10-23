import { describe, expect, it } from "vitest";
import { createSiteLookups, type SiteLookupModels } from "../lib/ai-builder/site-lookups";

const row = (id: string, slug: string, parentId: string | null, status = "publish") => ({ id, title: slug, slug, parentId, status, siteId: "s1" });

describe("list_pages lookup", () => {
	it("gives each page its full address, keeps a draft parent's slug and leaves out trashed pages", async () => {
		const rows = [row("g", "guides", null, "draft"), row("i", "install", "g"), row("a", "about", null), row("t", "old", "g", "trash")];
		const models = { pages: { findManyWhere: async () => rows } } as unknown as SiteLookupModels;
		const pages = (await createSiteLookups({ models, siteId: "s1" }).listPages?.()) ?? [];
		expect(pages.map((page) => [page.slug, page.path])).toEqual([
			["guides", "guides"],
			["install", "guides/install"],
			["about", "about"],
		]);
	});
});
