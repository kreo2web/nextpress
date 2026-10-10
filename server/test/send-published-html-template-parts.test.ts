import { beforeEach, describe, expect, it } from "vitest";
import type { Response } from "express";
import type { BlockConfig } from "@shared/schema-types";
import { buildTemplatePartBlock } from "@shared/template-parts";
import type { Deps } from "../routes/shared/deps";
import { sendPublishedHtml } from "../lib/send-published-html";
import { publishedPageCache } from "../lib/published-page-cache";

const SITE = "site-1";

type CapturedResponse = Response & { body: string; headers: Record<string, string> };

function captureResponse(): CapturedResponse {
	let body = "";
	const headers: Record<string, string> = {};
	const res = {
		req: { headers: {} },
		setHeader: (name: string, value: string) => {
			headers[name] = value;
			return res;
		},
		status: () => res,
		end: () => res,
		send: (html: string) => {
			body = html;
			return res;
		},
		get body() {
			return body;
		},
		get headers() {
			return headers;
		},
	};
	return res as unknown as CapturedResponse;
}

const heading = (id: string, value: string, parentId: string | null = null): BlockConfig => ({
	id,
	name: "core/heading",
	type: "block",
	parentId,
	content: { kind: "text", value, level: 2 },
});

const paragraph = (id: string, value: string, parentId: string | null = null): BlockConfig => ({
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

const headerTemplate = (headline: string, updatedAt: Date, blocks?: BlockConfig[]) => ({
	id: "header-tpl",
	name: "Site header",
	type: "header",
	other: { usage: "part", siteId: SITE },
	blocks: blocks ?? [shell("tpl-shell", [heading("tpl-h", headline)])],
	updatedAt,
});

/** A page with the header part, then a paragraph. */
const pageWithHeader = () => ({
	id: "page-1",
	title: "Home",
	status: "publish",
	siteId: SITE,
	version: 3,
	blocks: [shell("page-shell", [buildTemplatePartBlock({ id: "part-1", templateId: "header-tpl" }), paragraph("body", "Body text")])],
	other: { seo: {}, design: {} },
});

describe("published HTML with linked template parts", () => {
	const templates = new Map<string, ReturnType<typeof headerTemplate>>();
	const models = {
		users: { findById: async () => null },
		comments: { findManyWhere: async () => [] },
		posts: { findManyWhere: async () => [] },
		sites: { findById: async () => ({ id: SITE }) },
		templates: { findById: async (id: string) => templates.get(id) },
	} as unknown as Deps["models"];

	const publish = async (document: ReturnType<typeof pageWithHeader>) => {
		const res = captureResponse();
		await sendPublishedHtml({
			res,
			models,
			document,
			canonicalUrl: "http://localhost:5000/home",
		});
		return res;
	};

	beforeEach(() => {
		publishedPageCache.clear();
		templates.clear();
		templates.set("header-tpl", headerTemplate("Header v1", new Date("2026-10-01T09:00:00.000Z")));
	});

	it("publishes the template's current blocks in place of the part", async () => {
		const res = await publish(pageWithHeader());
		expect(res.headers["X-Nextpress-Cache"]).toBe("miss");
		expect(res.body).toContain("Header v1");
		expect(res.body).toContain("Body text");
		expect(res.body).not.toContain("core/template-part");
	});

	it("reuses the saved copy while the template is unchanged", async () => {
		await publish(pageWithHeader());
		const second = await publish(pageWithHeader());
		expect(second.headers["X-Nextpress-Cache"]).toBe("hit");
		expect(second.body).toContain("Header v1");
	});

	it("rebuilds the page with the new header once the template is updated", async () => {
		await publish(pageWithHeader());
		templates.set("header-tpl", headerTemplate("Header v2", new Date("2026-10-02T09:00:00.000Z")));

		const after = await publish(pageWithHeader());
		expect(after.headers["X-Nextpress-Cache"]).toBe("miss");
		expect(after.body).toContain("Header v2");
		expect(after.body).not.toContain("Header v1");
	});

	it("leaves out a part whose template is gone and still publishes the page", async () => {
		templates.delete("header-tpl");
		const res = await publish(pageWithHeader());
		expect(res.headers["X-Nextpress-Cache"]).toBe("miss");
		expect(res.body).toContain("Body text");
		expect(res.body).not.toContain("Header v1");
	});

	it("does not cache a page whose template holds a live block", async () => {
		templates.set(
			"header-tpl",
			headerTemplate("Header v1", new Date("2026-10-01T09:00:00.000Z"), [
				shell("tpl-shell", [
					heading("tpl-h", "Header v1"),
					{
						id: "comments",
						name: "post/comments",
						type: "block",
						parentId: null,
						content: { kind: "structured", data: { showForm: true, showCount: true } },
					},
				]),
			]),
		);
		const res = await publish(pageWithHeader());
		expect(res.headers["X-Nextpress-Cache"]).toBe("skip");
		expect(res.headers["Cache-Control"]).toBe("private, no-store");
	});
});
