import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNextpress, type BlockConfig } from "@nextpress-org/sdk";
import {
	createFakeApi,
	makeEntity,
	PAGE_ID,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WIDE_PAGE_ID = "00000000-0000-4000-8000-000000000008";
const STALE_TEXT = "The page changed somewhere else. Read the outline again.";

/** Only the block builders are used here; no request is ever made with this client. */
const builders = createNextpress({
	baseUrl: "https://cms.example.com",
	apiKey: "npk_live_test",
	siteId: SITE_ID,
	fetch: vi.fn() as typeof fetch,
}).blocks;

/** A page shell holding a main heading and an intro, and optionally a box that is too wide for phones. */
const buildPage = ({ withWideBox = false }: { withWideBox?: boolean } = {}): BlockConfig[] => [
	builders.fromName("core/page-shell", {
		id: "shell",
		children: [
			builders.heading({ id: "title", text: "Welcome", level: 1 }),
			builders.paragraph({ id: "intro", text: "Hello there" }),
			...(withWideBox ? [builders.group({ id: "wide", settings: { styles: { width: "900px" } } })] : []),
		],
	}),
];

const PRICING_SECTION = {
	op: "insert",
	parentId: "shell",
	block: {
		name: "core/stack",
		label: "Pricing",
		children: [
			{ name: "core/heading", content: { value: "Pricing", level: 2 } },
			{ name: "core/paragraph", content: { value: "Simple plans for small teams." } },
		],
	},
};

const writesTo = (api: FakeApi, path: string) =>
	api.requests.filter((request) => request.method === "PUT" && request.path === path);

describe("page editing tools over MCP", () => {
	let session: LinkedSession | undefined;
	let api: FakeApi;
	let logged: string[];

	const call = async (name: string, args: object) => {
		if (!session) throw new Error("test setup: no session");
		const result = await session.client.callTool({ name, arguments: args as Record<string, unknown> });
		return {
			isError: result.isError === true,
			text: textPayload(result as { content: Array<{ type: string; text?: string }> }),
		};
	};

	const open = async (fake: FakeApi) => {
		api = fake;
		session = await connectMcpSession(createSdkOverFakeApi(fake));
	};

	beforeEach(() => {
		logged = [];
		vi.spyOn(console, "error").mockImplementation((line: string) => {
			logged.push(line);
		});
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		if (session) {
			await session.close();
			session = undefined;
		}
	});

	describe("change_page_blocks", () => {
		it("inserts a section, saves with the version it read, and gives new blocks UUID ids", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 3 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("change_page_blocks", { id: PAGE_ID, ops: [PRICING_SECTION] });

			expect(result.isError).toBe(false);
			expect(result.text).toContain("Done: inserted");
			const saves = writesTo(api, `/api/pages/${PAGE_ID}`);
			expect(saves).toHaveLength(1);
			expect(saves[0]?.body.expectedVersion).toBe(3);

			const saved = saves[0]?.body.blocks as BlockConfig[];
			const shell = saved[0];
			expect(shell?.id).toBe("shell");
			expect(shell?.children?.map((child) => child.id).slice(0, 2)).toEqual(["title", "intro"]);
			const section = shell?.children?.[2];
			expect(section?.name).toBe("core/stack");
			expect(section?.label).toBe("Pricing");
			expect(section?.id).toMatch(UUID);
			expect(section?.parentId).toBe("shell");
			expect(section?.children?.map((child) => child.name)).toEqual(["core/heading", "core/paragraph"]);
			expect(section?.children?.every((child) => UUID.test(child.id) && child.parentId === section.id)).toBe(true);
			expect(section?.children?.[0]?.content).toMatchObject({ value: "Pricing", level: 2 });

			expect(page.version).toBe(4);
			expect(page.history[0]?.version).toBe(3);
		});

		it("finds a page by its slug and saves it under its id", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 1 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("change_page_blocks", { id: "home", ops: [PRICING_SECTION] });

			expect(result.isError).toBe(false);
			expect(writesTo(api, `/api/pages/${PAGE_ID}`)).toHaveLength(1);
		});

		it("starts the next change from the saved page and its new version", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 3 });
			await open(createFakeApi({ pages: [page] }));

			await call("change_page_blocks", { id: PAGE_ID, ops: [PRICING_SECTION] });
			const outline = await call("get_page_outline", { id: PAGE_ID });
			const second = await call("change_page_blocks", {
				id: PAGE_ID,
				ops: [{ op: "update", id: "title", content: { value: "Welcome back" } }],
			});

			expect(outline.text).toContain("Pricing");
			expect(second.isError).toBe(false);
			expect(writesTo(api, `/api/pages/${PAGE_ID}`).map((save) => save.body.expectedVersion)).toEqual([3, 4]);
			expect(page.version).toBe(5);
		});

		it("applies changes sent at the same moment one after another", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 0 });
			await open(createFakeApi({ pages: [page] }));
			const section = (name: string) => ({
				op: "insert",
				parentId: "shell",
				block: { name: "core/paragraph", label: name, content: { value: name } },
			});

			const [first, second] = await Promise.all([
				call("change_page_blocks", { id: PAGE_ID, ops: [section("First section")] }),
				call("change_page_blocks", { id: PAGE_ID, ops: [section("Second section")] }),
			]);

			expect(first.isError).toBe(false);
			expect(second.isError).toBe(false);
			expect(writesTo(api, `/api/pages/${PAGE_ID}`).map((save) => save.body.expectedVersion)).toEqual([0, 1]);
			const children = page.blocks[0]?.children ?? [];
			expect(children).toHaveLength(4);
			expect(children.slice(2).map((child) => child.label)).toEqual(["First section", "Second section"]);
		});

		it("tells the agent to read again when the page was saved somewhere else, and keeps the other save", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 3 });
			await open(createFakeApi({ pages: [page] }));
			const ownersBlocks = [builders.fromName("core/page-shell", { id: "shell", children: [builders.heading({ id: "owner", text: "Owner edit", level: 1 })] })];
			api.beforeNextSave = (entity) => {
				entity.blocks = ownersBlocks;
				entity.version = 4;
			};

			const result = await call("change_page_blocks", { id: PAGE_ID, ops: [PRICING_SECTION] });

			expect(result.isError).toBe(true);
			expect(result.text).toContain(STALE_TEXT);
			expect(page.blocks).toBe(ownersBlocks);
			expect(page.version).toBe(4);

			const retry = await call("change_page_blocks", { id: PAGE_ID, ops: [PRICING_SECTION] });
			expect(retry.isError).toBe(false);
			expect(page.version).toBe(5);
		});

		it("explains and logs a save the server refused, with the ids and the cause", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 3 });
			await open(createFakeApi({ pages: [page] }));
			api.failNextSave = { status: 500, message: "Database is down" };

			const result = await call("change_page_blocks", { id: PAGE_ID, ops: [PRICING_SECTION] });

			expect(result.isError).toBe(true);
			expect(result.text).toContain("The server did not accept the change: Database is down");
			expect(page.version).toBe(3);
			const entry = JSON.parse(logged[0] ?? "{}") as {
				atFunction: string;
				data: { toolName: string; id: string; contentType: string; expectedVersion: number };
				error: { message: string; status: number };
			};
			expect(entry.atFunction).toBe("createEntityContext.writeTree");
			expect(entry.data).toMatchObject({ toolName: "change_page_blocks", id: PAGE_ID, contentType: "page", expectedVersion: 3 });
			expect(entry.error).toMatchObject({ message: "Database is down", status: 500 });
		});

		it("never saves a change the page checks refuse", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 3 });
			await open(createFakeApi({ pages: [page] }));

			const refused = await call("change_page_blocks", {
				id: PAGE_ID,
				ops: [{ op: "insert", parentId: "intro", block: { name: "core/heading" } }],
			});
			const unknownBlock = await call("change_page_blocks", {
				id: PAGE_ID,
				ops: [{ op: "insert", parentId: "shell", block: { name: "core/not-a-block" } }],
			});
			const missingTarget = await call("change_page_blocks", {
				id: PAGE_ID,
				ops: [{ op: "delete", id: "no-such-block" }],
			});

			for (const result of [refused, unknownBlock, missingTarget]) {
				expect(result.isError).toBe(true);
			}
			expect(refused.text).toContain("Nothing was changed");
			expect(unknownBlock.text).toContain("Unknown block name");
			expect(missingTarget.text).toContain("Nothing was changed");
			expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(0);
			expect(page.version).toBe(3);
		});

		it("edits a blog post when content_type is post", async () => {
			const post = makeEntity({ id: POST_ID, slug: "news", title: "News", blocks: buildPage(), version: 7 });
			await open(createFakeApi({ posts: [post] }));

			const result = await call("change_page_blocks", { id: POST_ID, content_type: "post", ops: [PRICING_SECTION] });

			expect(result.isError).toBe(false);
			const saves = writesTo(api, `/api/posts/${POST_ID}`);
			expect(saves).toHaveLength(1);
			expect(saves[0]?.body.expectedVersion).toBe(7);
			expect(api.requests.some((request) => request.path.startsWith("/api/pages/"))).toBe(false);
			expect(post.version).toBe(8);
		});

		it("asks for a post's UUID when a post is named by its slug, and saves nothing", async () => {
			const post = makeEntity({ id: POST_ID, slug: "news", title: "News", blocks: buildPage(), version: 7 });
			await open(createFakeApi({ posts: [post] }));

			const result = await call("change_page_blocks", { id: "news", content_type: "post", ops: [PRICING_SECTION] });

			expect(result.isError).toBe(true);
			expect(result.text).toContain("The page could not be read");
			expect(api.requests).toHaveLength(0);
		});

		it("names the MCP tools, not the shared ones, in its replies", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 0 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("change_page_blocks", {
				id: PAGE_ID,
				ops: [{ op: "insert", parentId: "shell", block: { name: "core/group", styles: { width: "900px" } } }],
			});

			expect(result.isError).toBe(false);
			expect(result.text).toContain("apply_page_phone_fixes");
			expect(result.text).not.toMatch(/\bapply_phone_fixes\b/);
		});
	});

	describe("reading and checking", () => {
		it("get_page_outline lists the blocks with their ids", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 0 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("get_page_outline", { id: PAGE_ID });

			expect(result.isError).toBe(false);
			expect(result.text).toContain("page-shell id=shell");
			expect(result.text).toContain('heading id=title level=1 text="Welcome"');
		});

		it("get_page_block reads one block by block_id and keeps the page in id", async () => {
			const page = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 0 });
			await open(createFakeApi({ pages: [page] }));

			const result = await call("get_page_block", { id: PAGE_ID, block_id: "intro" });
			const missing = await call("get_page_block", { id: PAGE_ID, block_id: "nope" });

			expect(result.isError).toBe(false);
			const block = JSON.parse(result.text) as BlockConfig;
			expect(block.id).toBe("intro");
			expect(block.content).toMatchObject({ value: "Hello there" });
			expect(missing.isError).toBe(true);
			expect(missing.text).toContain("No block with id nope");
		});

		it("check_page reports a clean page, then a phone warning, and apply_page_phone_fixes repairs and saves it", async () => {
			const clean = makeEntity({ id: PAGE_ID, slug: "home", title: "Home", blocks: buildPage(), version: 0 });
			const wide = makeEntity({
				id: WIDE_PAGE_ID,
				slug: "wide",
				title: "Wide",
				blocks: buildPage({ withWideBox: true }),
				version: 2,
			});
			await open(createFakeApi({ pages: [clean, wide] }));

			const cleanResult = await call("check_page", { id: PAGE_ID });
			const warned = await call("check_page", { id: WIDE_PAGE_ID });
			const fixed = await call("apply_page_phone_fixes", { id: WIDE_PAGE_ID });
			const after = await call("check_page", { id: WIDE_PAGE_ID });

			expect(cleanResult.text).toContain("The page is clean");
			expect(warned.isError).toBe(false);
			expect(warned.text).toContain("phone warning");
			expect(fixed.isError).toBe(false);
			expect(fixed.text).toContain("Fixed 1 block");
			expect(writesTo(api, `/api/pages/${WIDE_PAGE_ID}`)[0]?.body.expectedVersion).toBe(2);
			const wideBox = wide.blocks[0]?.children?.find((child) => child.id === "wide");
			expect(wideBox?.styles).toMatchObject({ width: "100%" });
			expect(after.text).toContain("The page is clean");
		});

		it("reports a page that cannot be found, saves nothing, and logs which page it was", async () => {
			await open(createFakeApi());

			const result = await call("get_page_outline", { id: "missing-page" });

			expect(result.isError).toBe(true);
			expect(result.text).toContain("The page could not be read");
			expect(api.requests.filter((request) => request.method !== "GET")).toHaveLength(0);
			const entry = JSON.parse(logged[0] ?? "{}") as { data: { toolName: string; id: string }; error: { status: number } };
			expect(entry.data).toMatchObject({ toolName: "get_page_outline", id: "missing-page" });
			expect(entry.error.status).toBe(404);
		});
	});

	describe("tools that need no page", () => {
		it("list_block_types gives every block a note on when to use it", async () => {
			await open(createFakeApi());

			const result = await call("list_block_types", {});

			expect(result.isError).toBe(false);
			const heading = result.text.split("\n").find((line) => line.startsWith("core/heading | "));
			expect(heading).toMatch(/^core\/heading \| .+ \| block \| .+ \| .{20,}/);
			expect(result.text).toContain("core/page-shell | ");
		});

		it("list_block_types puts the docs blocks in the docs category, and a bare docs name is refused with the full one", async () => {
			await open(createFakeApi());

			const list = await call("list_block_types", {});
			const bare = await call("get_block_type", { name: "callout" });

			expect(list.text).toMatch(/^docs\/callout \| Callout \| container \| docs \| .{20,}/m);
			expect(list.text).toMatch(/^core\/code \| Code \| block \| advanced \(also docs\) \| .{20,}/m);
			expect(bare.isError).toBe(true);
			expect(bare.text).toContain("Did you mean docs/callout?");
		});

		it("get_block_type shows an example, and suggests names for a half-typed one", async () => {
			await open(createFakeApi());

			const known = await call("get_block_type", { name: "core/stack" });
			const typo = await call("get_block_type", { name: "stac" });

			expect(known.isError).toBe(false);
			expect(known.text).toContain("core/stack: ");
			expect(known.text).toContain("Example (what a new one looks like");
			expect(known.text).toContain("Content fields: stackType (text)");
			expect(typo.isError).toBe(true);
			expect(typo.text).toContain("Unknown block name");
			expect(typo.text).toContain("core/stack");
		});

		it("get_design_guide returns the guide", async () => {
			await open(createFakeApi());

			const result = await call("get_design_guide", {});

			expect(result.isError).toBe(false);
			expect(result.text).toContain("# Building NextPress pages");
			expect(result.text).toContain("One level-1 heading per page");
		});
	});
});
