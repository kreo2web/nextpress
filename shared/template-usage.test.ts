import { describe, expect, it } from "vitest";
import {
	buildTemplatePartMarker,
	isTemplatePart,
	keepTemplateUsage,
	readTemplatePartSiteId,
} from "./template-usage";

describe("template usage marker", () => {
	it("treats a row without the marker as a pre-designed block", () => {
		expect(isTemplatePart({})).toBe(false);
		expect(isTemplatePart(null)).toBe(false);
		expect(isTemplatePart(undefined)).toBe(false);
		expect(isTemplatePart({ usage: "block" })).toBe(false);
		expect(readTemplatePartSiteId({})).toBeNull();
	});

	it("reads a linked part and the site it belongs to", () => {
		const other = { usage: "part", siteId: "site-a" };
		expect(isTemplatePart(other)).toBe(true);
		expect(readTemplatePartSiteId(other)).toBe("site-a");
	});

	it("does not read a site from a row that is not a part", () => {
		expect(readTemplatePartSiteId({ siteId: "site-a" })).toBeNull();
	});

	it("treats a blank site as no site", () => {
		expect(readTemplatePartSiteId({ usage: "part", siteId: "   " })).toBeNull();
	});

	it("builds the marker written on a new part", () => {
		expect(buildTemplatePartMarker({ siteId: "site-a" })).toEqual({ usage: "part", siteId: "site-a" });
	});

	describe("keepTemplateUsage", () => {
		it("never turns a pre-designed block into a part", () => {
			const next = keepTemplateUsage({
				stored: {},
				incoming: { usage: "part", siteId: "site-b", note: "kept" },
			});
			expect(next).toEqual({ note: "kept" });
		});

		it("keeps a part's kind and site when the client sends other content", () => {
			const next = keepTemplateUsage({
				stored: { usage: "part", siteId: "site-a" },
				incoming: { usage: "block", siteId: "site-b", note: "kept" },
			});
			expect(next).toEqual({ note: "kept", usage: "part", siteId: "site-a" });
		});

		it("returns an empty object when a pre-designed block sends no other content", () => {
			expect(keepTemplateUsage({ stored: null, incoming: undefined })).toEqual({});
		});
	});
});
