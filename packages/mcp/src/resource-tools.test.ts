import { afterEach, describe, expect, it, vi } from "vitest";
import { createNextpress, type BlockConfig } from "@nextpress-org/sdk";
import {
	createFakeApi,
	makeEntity,
	PAGE_ID,
	PART_ID,
	POST_ID,
	SITE_ID,
	type FakeApi,
} from "./test/fake-nextpress-api.js";
import {
	connectMcpSession,
	createSdkOverFakeApi,
	textPayload,
	type LinkedSession,
} from "./test/mcp-session.js";

const builders = createNextpress({
	baseUrl: "https://cms.example.com",
	apiKey: "npk_live_test",
	siteId: SITE_ID,
	fetch: vi.fn() as typeof fetch,
}).blocks;

const pageWith = (headline: string): BlockConfig[] => [
	builders.fromName("core/page-shell", {
		id: "shell",
		children: [builders.heading({ id: "title", text: headline, level: 1 }), builders.paragraph({ id: "intro", text: "Hello there" })],
	}),
];

describe("tools over the newer SDK features", () => {
	let session: LinkedSession | undefined;
	let api: FakeApi;

	const open = async (fake: FakeApi) => {
		api = fake;
		session = await connectMcpSession(createSdkOverFakeApi(fake));
	};

	const call = async (name: string, args: object) => {
		if (!session) throw new Error("test setup: no session");
		const result = await session.client.callTool({ name, arguments: args as Record<string, unknown> });
		const text = textPayload(result as { content: Array<{ type: string; text?: string }> });
		return { isError: result.isError === true, text, json: () => JSON.parse(text) as Record<string, unknown> };
	};

	afterEach(async () => {
		await session?.close();
		session = undefined;
	});

	describe("page history", () => {
		const pageWithHistory = () =>
			makeEntity({
				id: PAGE_ID,
				slug: "home",
				title: "Home",
				blocks: pageWith("Current words"),
				version: 5,
				history: [
					{ version: 4, updatedAt: "2026-10-16T09:00:00.000Z", blocks: pageWith("Fourth try"), authorId: "user-1" },
					{ version: 2, updatedAt: "2026-10-15T09:00:00.000Z", blocks: [] },
				],
			});

		it("get_page_history lists versions with block counts and without the blocks", async () => {
			await open(createFakeApi({ pages: [pageWithHistory()] }));

			const result = await call("get_page_history", { id: PAGE_ID });

			expect(result.isError).toBe(false);
			expect(result.json()).toEqual({
				pageId: PAGE_ID,
				currentVersion: 5,
				versions: [
					{ version: 4, savedAt: "2026-10-16T09:00:00.000Z", authorId: "user-1", blockCount: 3 },
					{ version: 2, savedAt: "2026-10-15T09:00:00.000Z", blockCount: 0 },
				],
			});
			expect(result.text).not.toContain('"blocks"');
		});

		it("get_page_history accepts a slug", async () => {
			await open(createFakeApi({ pages: [pageWithHistory()] }));

			const result = await call("get_page_history", { id: "home" });

			expect(result.isError).toBe(false);
			expect(result.json().pageId).toBe(PAGE_ID);
			expect(api.requests.map((request) => request.path)).toEqual([
				"/api/pages/home",
				`/api/pages/${PAGE_ID}/history`,
			]);
		});

		it("restore_page_version puts the earlier blocks back when the page has not moved on", async () => {
			const page = pageWithHistory();
			await open(createFakeApi({ pages: [page] }));

			const result = await call("restore_page_version", { id: PAGE_ID, version: 4, expectedVersion: 5 });

			expect(result.isError).toBe(false);
			const body = result.json();
			expect(body).toMatchObject({ id: PAGE_ID, version: 6, restoredFrom: 4 });
			expect(body.outline).toContain('heading id=title level=1 text="Fourth try"');
			const restores = api.requests.filter((request) => request.method === "POST" && request.path.endsWith("/restore"));
			expect(restores).toHaveLength(1);
			expect(restores[0]?.body).toEqual({ version: 4 });
			expect(page.blocks[0]?.children?.[0]?.content).toMatchObject({ value: "Fourth try" });
		});

		it("restore_page_version restores nothing when the page was saved since", async () => {
			const page = pageWithHistory();
			await open(createFakeApi({ pages: [page] }));

			const result = await call("restore_page_version", { id: PAGE_ID, version: 4, expectedVersion: 4 });

			expect(result.isError).toBe(true);
			expect(result.text).toContain("it is now at version 5, not 4");
			expect(api.requests.some((request) => request.method === "POST")).toBe(false);
			expect(page.version).toBe(5);
		});

		it("restore_page_version says plainly when the version is not in the history", async () => {
			await open(createFakeApi({ pages: [pageWithHistory()] }));

			const result = await call("restore_page_version", { id: PAGE_ID, version: 99, expectedVersion: 5 });

			expect(result.isError).toBe(true);
			expect(result.json()).toMatchObject({ status: 404, message: "Version not found in history" });
		});
	});

	describe("template parts", () => {
		const header = (): BlockConfig => builders.fromName("core/header", { id: "header-1" });

		it("list_template_parts shows each part's root block and how many pages use it, without the blocks", async () => {
			const fake = createFakeApi();
			fake.templateParts.push({ id: PART_ID, type: "part", name: "Main header", blocks: [header()], usedOnPages: 3 });
			await open(fake);

			const result = await call("list_template_parts", {});

			expect(result.isError).toBe(false);
			expect(result.json().parts).toEqual([{ id: PART_ID, name: "Main header", rootBlock: "core/header", usedOnPages: 3 }]);
			expect(result.text).not.toContain('"blocks"');
			expect(api.requests[0]?.query.get("usage")).toBe("part");
		});

		it("create_template_part starts an empty part from a root block and says how to use it", async () => {
			await open(createFakeApi());

			const result = await call("create_template_part", { name: "Main footer", rootBlock: "core/stack" });

			expect(result.isError).toBe(false);
			const sent = api.requests.find((request) => request.method === "POST");
			expect(sent?.body).toMatchObject({ name: "Main footer", usage: "part" });
			expect((sent?.body.blocks as BlockConfig[]).map((block) => block.name)).toEqual(["core/stack"]);
			expect(result.json()).toMatchObject({ id: PART_ID, name: "Main footer", rootBlock: "core/stack" });
			expect(result.json().howToUse).toContain("templateId");
		});

		it("create_template_part refuses several top-level blocks and never sends them", async () => {
			await open(createFakeApi());

			const result = await call("create_template_part", {
				name: "Two things",
				blocks: [builders.group({ id: "a" }), builders.group({ id: "b" })],
			});

			expect(result.isError).toBe(true);
			expect(result.text).toContain("A template is one layout block");
			expect(api.requests).toHaveLength(0);
		});

		it("create_template_part refuses blocks and a root block together", async () => {
			await open(createFakeApi());

			const result = await call("create_template_part", {
				name: "Both",
				rootBlock: "core/group",
				blocks: [builders.group({ id: "a" })],
			});

			expect(result.isError).toBe(true);
			expect(result.text).toContain("either blocks or rootBlock");
			expect(api.requests).toHaveLength(0);
		});

		it("get_template_part_usage lists the pages that show a part", async () => {
			const fake = createFakeApi();
			fake.partUsage.set(PART_ID, [{ id: PAGE_ID, title: "Home", status: "publish" }]);
			await open(fake);

			const result = await call("get_template_part_usage", { id: PART_ID });

			expect(result.isError).toBe(false);
			expect(result.json()).toEqual({
				id: PART_ID,
				pageCount: 1,
				pages: [{ id: PAGE_ID, title: "Home", status: "publish" }],
			});
		});
	});

	describe("form answers", () => {
		it("list_form_submissions reads answers with the filters, and changes nothing", async () => {
			const fake = createFakeApi();
			fake.submissions.push({
				id: "00000000-0000-4000-8000-000000000009",
				siteId: SITE_ID,
				pageId: PAGE_ID,
				formName: "Contact",
				fields: [{ name: "email", label: "Email", value: "ada@example.com" }],
				status: "new",
				createdAt: "2026-10-17T08:00:00.000Z",
			});
			await open(fake);

			const result = await call("list_form_submissions", { form: "Contact", status: "new" });

			expect(result.isError).toBe(false);
			const body = result.json() as { items: Array<{ formName: string; fields: Array<{ value: string }> }>; formNames: string[]; unread: number };
			expect(body.items[0]?.formName).toBe("Contact");
			expect(body.items[0]?.fields[0]?.value).toBe("ada@example.com");
			expect(body.formNames).toEqual(["Contact"]);
			expect(body.unread).toBe(1);
			expect(api.requests).toHaveLength(1);
			expect(api.requests[0]).toMatchObject({ method: "GET", path: "/api/forms/submissions" });
			expect(api.requests[0]?.query.get("form")).toBe("Contact");
			expect(api.requests[0]?.query.get("status")).toBe("new");
		});

		it("list_form_submissions rejects a status the server does not know", async () => {
			await open(createFakeApi());

			const result = await call("list_form_submissions", { status: "archived" });

			expect(result.isError).toBe(true);
			expect(api.requests).toHaveLength(0);
		});
	});

	describe("brand logos", () => {
		it("copy_brand_logo saves the logo and returns the media item to use", async () => {
			await open(createFakeApi());

			const result = await call("copy_brand_logo", { url: "https://svgl.app/library/github.svg", title: "GitHub" });

			expect(result.isError).toBe(false);
			expect(result.json()).toMatchObject({ url: "/uploads/github.svg", alt: "GitHub" });
			expect(api.requests[0]).toMatchObject({ method: "POST", path: "/api/media/svgl" });
			expect(api.requests[0]?.body).toEqual({ url: "https://svgl.app/library/github.svg", title: "GitHub" });
		});

		it("copy_brand_logo refuses addresses that are not on svgl.app, before any request", async () => {
			await open(createFakeApi());

			const result = await call("copy_brand_logo", { url: "https://example.com/logo.svg" });

			expect(result.isError).toBe(true);
			expect(result.text).toContain("svgl.app");
			expect(api.requests).toHaveLength(0);
		});
	});

	describe("patch tools keep working and accept replace", () => {
		const replaceIntro = {
			op: "replace",
			id: "intro",
			block: { name: "core/heading", id: "new-heading" },
		};

		it("patch_page_blocks replaces a block and everything inside it", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: pageWith("Welcome"), version: 3 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("patch_page_blocks", { id: PAGE_ID, expectedVersion: 3, ops: [replaceIntro] });

			expect(result.isError).toBe(false);
			expect((result.json().summary as { replaced: string[] }).replaced).toEqual(["new-heading"]);
			const save = api.requests.find((request) => request.method === "PUT");
			expect(save?.body.expectedVersion).toBe(3);
			const shellChildren = (save?.body.blocks as BlockConfig[])[0]?.children ?? [];
			expect(shellChildren.map((child) => child.id)).toEqual(["title", "new-heading"]);
			expect(shellChildren[1]?.name).toBe("core/heading");
		});

		it("patch_post_blocks replaces a block in a post", async () => {
			const post = makeEntity({ id: POST_ID, slug: "news", title: "News", blocks: pageWith("Welcome"), version: 1 });
			await open(createFakeApi({ posts: [post] }));

			const result = await call("patch_post_blocks", { id: POST_ID, expectedVersion: 1, ops: [replaceIntro] });

			expect(result.isError).toBe(false);
			expect(post.blocks[0]?.children?.map((child) => child.id)).toEqual(["title", "new-heading"]);
		});

		it("patch_page_blocks still refuses an op it does not know", async () => {
			await open(createFakeApi());

			const result = await call("patch_page_blocks", {
				id: PAGE_ID,
				expectedVersion: 0,
				ops: [{ op: "swap", id: "intro" }],
			});

			expect(result.isError).toBe(true);
			expect(api.requests).toHaveLength(0);
		});
	});
});
