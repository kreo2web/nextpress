import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { templates, users } from "@shared/schema";
import type { BlockConfig } from "@shared/schema-types";
import { testDb } from "./setup";
import { initializeDefaultTemplates } from "../initialize-default-templates";

// The seeding reads and writes templates through the app's models; point them at the in-memory test database.
vi.mock("../storage", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../storage")>();
	const { testDb: memoryDb } = await import("./setup");
	return { ...actual, models: { ...actual.models, templates: actual.createTemplateModel(memoryDb) } };
});

const OWNER_ID = "550e8400-e29b-41d4-a716-4466554400a1";

const seededRows = () => testDb.select().from(templates);

describe("initializeDefaultTemplates", () => {
	beforeEach(async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		await testDb.delete(templates);
		await testDb.delete(users);
		await testDb.insert(users).values({
			id: OWNER_ID,
			username: "owner",
			email: "owner@example.com",
			password: "hashed",
			status: "active",
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("seeds exactly Basic Page and Basic Post on a fresh install, and no docs page", async () => {
		await initializeDefaultTemplates({ authorId: OWNER_ID });

		const rows = await seededRows();
		expect(rows.map((row) => `${row.name} (${row.type})`).sort()).toEqual(["Basic Page (page)", "Basic Post (post)"]);
		expect(rows.every((row) => row.authorId === OWNER_ID)).toBe(true);
	});

	it("gives the Basic Page a page shell holding a heading, a paragraph and a button", async () => {
		await initializeDefaultTemplates({ authorId: OWNER_ID });

		const page = (await seededRows()).find((row) => row.name === "Basic Page");
		const blocks = (page?.blocks ?? []) as BlockConfig[];
		expect(blocks.map((block) => block.name)).toEqual(["core/page-shell"]);
		expect(blocks[0].children?.map((child) => child.name)).toEqual(["core/heading", "core/paragraph", "core/button"]);
	});

	it("adds nothing a second time", async () => {
		await initializeDefaultTemplates({ authorId: OWNER_ID });
		await initializeDefaultTemplates({ authorId: OWNER_ID });

		expect(await seededRows()).toHaveLength(2);
	});

	it("leaves a site that already has a template alone", async () => {
		await testDb.insert(templates).values({ name: "My layout", type: "page", authorId: OWNER_ID, blocks: [] });

		await initializeDefaultTemplates({ authorId: OWNER_ID });

		expect((await seededRows()).map((row) => row.name)).toEqual(["My layout"]);
	});
});
