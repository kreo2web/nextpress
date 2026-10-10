import { beforeEach, describe, expect, it } from "vitest";
import { testDb } from "./setup";
import { createPageModel, createSiteModel, createTemplateModel, createUserRoleModel } from "../storage";
import { pages, sites, templates, users } from "@shared/schema";
import { buildTemplatePartBlock } from "@shared/template-parts";
import {
	canManageTemplate,
	findTemplatePartUsage,
	listLinkedTemplateParts,
	listPreDesignedTemplates,
} from "../lib/template-parts";

const ids = {
	owner: "550e8400-e29b-41d4-a716-4466554400a1",
	siteA: "550e8400-e29b-41d4-a716-4466554400a2",
	siteB: "550e8400-e29b-41d4-a716-4466554400a3",
	headerA: "550e8400-e29b-41d4-a716-4466554400b1",
	footerA: "550e8400-e29b-41d4-a716-4466554400b2",
	headerB: "550e8400-e29b-41d4-a716-4466554400b3",
	starterPage: "550e8400-e29b-41d4-a716-4466554400b4",
	starterPost: "550e8400-e29b-41d4-a716-4466554400b5",
	pagePublished: "550e8400-e29b-41d4-a716-4466554400c1",
	pageDraft: "550e8400-e29b-41d4-a716-4466554400c2",
	pageTrashed: "550e8400-e29b-41d4-a716-4466554400c3",
	pageOtherSite: "550e8400-e29b-41d4-a716-4466554400c4",
	pagePlain: "550e8400-e29b-41d4-a716-4466554400c5",
};

const shellWith = (children: unknown[]) => [
	{
		id: "shell",
		name: "core/page-shell",
		type: "container",
		parentId: null,
		content: { kind: "structured", data: {} },
		children,
	},
];

const plainText = {
	id: "body",
	name: "core/paragraph",
	type: "block",
	parentId: "shell",
	content: { kind: "text", value: "Just words" },
};

const models = {
	templates: createTemplateModel(testDb),
	pages: createPageModel(testDb),
	sites: createSiteModel(testDb),
	userRoles: createUserRoleModel(testDb),
};

const partOf = (id: string, templateId: string) => buildTemplatePartBlock({ id, templateId });

describe("linked template lists and usage", () => {
	beforeEach(async () => {
		await testDb.delete(pages);
		await testDb.delete(templates);
		await testDb.delete(sites);
		await testDb.delete(users);

		await testDb.insert(users).values({
			id: ids.owner,
			username: "owner",
			email: "owner@example.com",
			password: "hashed",
			status: "active",
		});
		await testDb.insert(sites).values([
			{ id: ids.siteA, name: "Site A", ownerId: ids.owner },
			{ id: ids.siteB, name: "Site B", ownerId: ids.owner },
		]);

		await testDb.insert(templates).values([
			{ id: ids.headerA, name: "Main header", type: "header", authorId: ids.owner, blocks: [], other: { usage: "part", siteId: ids.siteA } },
			{ id: ids.footerA, name: "Footer", type: "footer", authorId: ids.owner, blocks: [], other: { usage: "part", siteId: ids.siteA } },
			{ id: ids.headerB, name: "Other site header", type: "header", authorId: ids.owner, blocks: [], other: { usage: "part", siteId: ids.siteB } },
			{ id: ids.starterPage, name: "Basic Page", type: "page", authorId: ids.owner, blocks: [], other: {} },
			{ id: ids.starterPost, name: "Basic Post", type: "post", authorId: ids.owner, blocks: [] },
		]);

		await testDb.insert(pages).values([
			{ id: ids.pagePublished, title: "Home", slug: "home", siteId: ids.siteA, authorId: ids.owner, status: "publish", blocks: shellWith([partOf("p1", ids.headerA), plainText]) },
			{ id: ids.pageDraft, title: "Draft", slug: "draft", siteId: ids.siteA, authorId: ids.owner, status: "draft", blocks: shellWith([partOf("p2", ids.footerA)]) },
			{ id: ids.pageTrashed, title: "Old", slug: "old", siteId: ids.siteA, authorId: ids.owner, status: "trash", blocks: shellWith([partOf("p3", ids.headerA)]) },
			{ id: ids.pageOtherSite, title: "Elsewhere", slug: "elsewhere", siteId: ids.siteB, authorId: ids.owner, status: "publish", blocks: shellWith([partOf("p4", ids.headerB)]) },
			{ id: ids.pagePlain, title: "About", slug: "about", siteId: ids.siteA, authorId: ids.owner, status: "publish", blocks: shellWith([plainText]) },
		]);
	});

	it("lists only pre-designed blocks in the default list", async () => {
		const result = await listPreDesignedTemplates({ models, page: 1, perPage: 10 });
		expect(result.templates.map((row) => row.name).sort()).toEqual(["Basic Page", "Basic Post"]);
		expect(result.total).toBe(2);
		expect(result.total_pages).toBe(1);
	});

	it("narrows the pre-designed list by type without showing parts", async () => {
		const pagesOnly = await listPreDesignedTemplates({ models, type: "page", page: 1, perPage: 10 });
		expect(pagesOnly.templates.map((row) => row.name)).toEqual(["Basic Page"]);
	});

	it("lists the linked parts of one site only, with the pages that use each", async () => {
		const result = await listLinkedTemplateParts({ models, siteId: ids.siteA, page: 1, perPage: 10 });
		expect(result.templates.map((row) => [row.name, row.usedOnPages])).toEqual([
			["Footer", 1],
			["Main header", 1],
		]);
		expect(result.total).toBe(2);
	});

	it("shows the other site's parts only to that site", async () => {
		const result = await listLinkedTemplateParts({ models, siteId: ids.siteB, page: 1, perPage: 10 });
		expect(result.templates.map((row) => [row.name, row.usedOnPages])).toEqual([["Other site header", 1]]);
	});

	it("counts draft pages but not trashed ones, and lists the pages by title", async () => {
		const usage = await findTemplatePartUsage({ models, siteId: ids.siteA });
		expect(usage.get(ids.headerA)).toEqual([{ id: ids.pagePublished, title: "Home", status: "publish" }]);
		expect(usage.get(ids.footerA)).toEqual([{ id: ids.pageDraft, title: "Draft", status: "draft" }]);
	});

	it("reports no usage for a part that no page shows", async () => {
		await testDb.insert(templates).values({
			id: "550e8400-e29b-41d4-a716-4466554400d1",
			name: "Unused section",
			type: "section",
			authorId: ids.owner,
			blocks: [],
			other: { usage: "part", siteId: ids.siteA },
		});
		const result = await listLinkedTemplateParts({ models, siteId: ids.siteA, page: 1, perPage: 10 });
		expect(result.templates.find((row) => row.name === "Unused section")?.usedOnPages).toBe(0);
	});

	it("lets a user manage a part only for a site they can reach", async () => {
		const partId = "550e8400-e29b-41d4-a716-4466554400d2";
		await testDb.insert(templates).values({
			id: partId,
			name: "Hidden header",
			type: "header",
			authorId: ids.owner,
			blocks: [],
			other: { usage: "part", siteId: ids.siteB },
		});
		const part = await models.templates.findById(partId);
		const starter = await models.templates.findById(ids.starterPage);
		if (!part || !starter) throw new Error("Fixture templates were not inserted");

		const stranger = "550e8400-e29b-41d4-a716-4466554400ff";
		expect(await canManageTemplate({ models, userId: ids.owner, keySiteId: null, template: part })).toBe(true);
		expect(await canManageTemplate({ models, userId: stranger, keySiteId: null, template: part })).toBe(false);
		expect(await canManageTemplate({ models, userId: null, keySiteId: null, template: part })).toBe(false);
		expect(await canManageTemplate({ models, userId: ids.owner, keySiteId: ids.siteA, template: part })).toBe(false);
		expect(await canManageTemplate({ models, userId: stranger, keySiteId: null, template: starter })).toBe(true);
	});
});
