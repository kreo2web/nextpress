import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNextpress } from "@nextpress-org/sdk";
import { DOCS_GUIDE } from "./docs/docs-guide.js";
import {
	createFakeDocsApi,
	DOCS_GROUP_ID,
	DOCS_HOME_ID,
	DOCS_INSTALL_ID,
	DOCS_UPGRADE_ID,
	type FakeDocsApi,
} from "./test/fake-docs-api.js";
import type { JsonObject } from "./test/json-value.js";
import { SITE_ID } from "./test/fake-nextpress-api.js";
import { connectMcpSession, textPayload, type LinkedSession } from "./test/mcp-session.js";

const MISSING_PAGE_ID = "00000000-0000-4000-8000-0000000000ff";
const DOCS_TOOL_NAMES = [
	"list_docs",
	"create_docs",
	"get_docs_tree",
	"update_docs_settings",
	"get_docs_guide",
	"add_docs_page",
	"update_docs_page",
	"reorder_docs_pages",
	"delete_docs_page",
	"read_docs_page",
	"write_docs_page",
];

type ListedTool = {
	name: string;
	description?: string;
	inputSchema: { properties?: Record<string, object>; required?: string[] };
	annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
};

describe("docs tools over MCP", () => {
	let session: LinkedSession | undefined;
	let api: FakeDocsApi;
	let logged: string[];

	const open = async (fake: FakeDocsApi) => {
		api = fake;
		session = await connectMcpSession(
			createNextpress({ baseUrl: "https://cms.example.com", apiKey: "npk_live_test", siteId: SITE_ID, fetch: fake.fetch }),
		);
	};

	const call = async (name: string, args: JsonObject) => {
		if (!session) throw new Error("test setup: no session");
		const result = await session.client.callTool({ name, arguments: args });
		return {
			isError: result.isError === true,
			text: textPayload(result as { content: Array<{ type: string; text?: string }> }),
		};
	};

	beforeEach(async () => {
		logged = [];
		vi.spyOn(console, "error").mockImplementation((line: string) => {
			logged.push(line);
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await open(createFakeDocsApi());
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await session?.close();
		session = undefined;
	});

	describe("what the server offers", () => {
		it("lists every docs tool with a plain description and the inputs it needs", async () => {
			const tools = (await session!.client.listTools()).tools as ListedTool[];
			const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

			expect(Object.keys(byName)).toEqual(expect.arrayContaining(DOCS_TOOL_NAMES));
			for (const name of DOCS_TOOL_NAMES) {
				expect(byName[name]?.description?.length ?? 0, name).toBeGreaterThan(80);
			}
			expect(byName.add_docs_page?.inputSchema.required).toEqual(expect.arrayContaining(["homeId", "kind", "title"]));
			expect(byName.write_docs_page?.inputSchema.required).toEqual(expect.arrayContaining(["pageId", "mdx", "expectedVersion"]));
			expect(byName.update_docs_settings?.inputSchema.required).toEqual(["homeId"]);
			expect(byName.reorder_docs_pages?.inputSchema.required).toEqual(expect.arrayContaining(["homeId", "orderedIds"]));
			expect(byName.read_docs_page?.inputSchema.required).toEqual(["pageId"]);
			expect(byName.get_docs_guide?.inputSchema.properties).toEqual({});
		});

		it("marks the read tools read-only, and deleting as destructive", async () => {
			const tools = (await session!.client.listTools()).tools as ListedTool[];
			const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

			for (const name of ["list_docs", "get_docs_tree", "read_docs_page", "get_docs_guide"]) {
				expect(byName[name]?.annotations?.readOnlyHint, name).toBe(true);
			}
			expect(byName.delete_docs_page?.annotations?.destructiveHint).toBe(true);
		});
	});

	describe("reading the docs", () => {
		it("lists this site's docs by their address and page count", async () => {
			const result = await call("list_docs", {});

			expect(result.isError).toBe(false);
			const body = JSON.parse(result.text) as { docs: Array<{ homeId: string; name: string; address: string; pages: number; searchOn: boolean; status: string }> };
			expect(body.docs).toEqual([
				{ homeId: DOCS_HOME_ID, name: "Acme Docs", address: "/docs", pages: 4, searchOn: true, status: "draft" },
			]);
		});

		it("says how to start when the site has no docs", async () => {
			await session?.close();
			await open(createFakeDocsApi({ withDocs: false }));

			const result = await call("list_docs", {});

			expect(JSON.parse(result.text)).toMatchObject({ docs: [], hint: expect.stringContaining("create_docs") });
		});

		it("gives the tree with each page's address, kind and place in the order", async () => {
			const result = await call("get_docs_tree", { homeId: DOCS_HOME_ID });

			expect(result.isError).toBe(false);
			const body = JSON.parse(result.text) as {
				home: { address: string; pagesUnder: Array<{ id: string; kind: string; address: string; pagesUnder: Array<{ address: string }> }> };
			};
			expect(body.home.address).toBe("/docs");
			expect(body.home.pagesUnder[0]).toMatchObject({ id: DOCS_GROUP_ID, kind: "group", address: "/docs/getting-started" });
			expect(body.home.pagesUnder[0]?.pagesUnder[0]?.address).toBe("/docs/getting-started/install");
			expect(body.home.pagesUnder[1]?.address).toBe("/docs/upgrade");
		});

		it("gives the guide as the same text the guide resource and the write_docs prompt carry", async () => {
			const result = await call("get_docs_guide", {});

			expect(result.isError).toBe(false);
			expect(result.text).toBe(DOCS_GUIDE);
		});
	});

	describe("the docs and their settings", () => {
		it("makes a docs and gives its id for the other tools", async () => {
			const result = await call("create_docs", { name: "Acme API", slug: "api" });

			expect(result.isError).toBe(false);
			expect(result.text).toMatch(/^Made the docs "Acme API" at \/api\. Its id is [0-9a-f-]{36}: pass it as homeId/);
			expect(api.requests.find((request) => request.method === "POST" && request.path === "/api/docs")?.body).toMatchObject({
				name: "Acme API",
				slug: "api",
			});
		});

		it("saves only the settings it is given, and says what they are now", async () => {
			const result = await call("update_docs_settings", { homeId: DOCS_HOME_ID, title: "Acme", features: { toc: false } });

			expect(result.isError).toBe(false);
			expect(result.text.startsWith("Saved the docs settings. Now:")).toBe(true);
			const saved = api.settings.get(DOCS_HOME_ID);
			expect(saved?.title).toBe("Acme");
			expect(saved?.features).toEqual({ sidebar: true, toc: false, prevNext: true, copyPage: true });
		});
	});

	describe("the pages and groups", () => {
		it("adds a page under a group, with its starting text, as a draft at the right address", async () => {
			const result = await call("add_docs_page", {
				homeId: DOCS_HOME_ID,
				parentId: DOCS_GROUP_ID,
				kind: "page",
				title: "Quickstart",
				mdx: "Run it.\n",
				position: 0,
			});

			expect(result.isError).toBe(false);
			expect(result.text).toContain('Added the page "Quickstart" at /docs/getting-started/quickstart.');
			expect(result.text).toContain("It is a draft.");
			const added = [...api.rows.values()].find((item) => item.title === "Quickstart");
			expect(added).toMatchObject({ status: "draft", mdx: "Run it.\n", group: false });
		});

		it("adds a group under the top of the docs when no parent is given", async () => {
			const result = await call("add_docs_page", { homeId: DOCS_HOME_ID, kind: "group", title: "Guides" });

			expect(result.isError).toBe(false);
			expect(result.text).toContain('Added the group "Guides" at /docs/guides.');
		});

		it("refuses text on a group before calling the server, and says where the text goes", async () => {
			const before = api.requests.length;

			const result = await call("add_docs_page", { homeId: DOCS_HOME_ID, kind: "group", title: "Guides", mdx: "Text" });

			expect(result.isError).toBe(true);
			expect(result.text).toMatch(/^A group holds no text\./);
			expect(api.requests.length).toBe(before);
		});

		it("moves, renames, hides and changes the address of a page, and warns about the old address", async () => {
			const result = await call("update_docs_page", {
				pageId: DOCS_UPGRADE_ID,
				move_under: DOCS_GROUP_ID,
				address: "upgrading",
				hide: true,
			});

			expect(result.isError).toBe(false);
			expect(result.text).toBe(
				'Updated the page "Upgrade". Its address is /docs/getting-started/upgrading. It is hidden from the sidebar. Links to the old address will not work until they are changed.',
			);
		});

		it("refuses to hide the docs home, with the server's words", async () => {
			const result = await call("update_docs_page", { pageId: DOCS_HOME_ID, hide: true });

			expect(result.isError).toBe(true);
			expect(result.text).toBe("The docs home is always a page in the sidebar.");
		});

		it("sets the order of one parent's pages, and a list that is not exact moves nothing", async () => {
			const moved = await call("reorder_docs_pages", {
				homeId: DOCS_HOME_ID,
				orderedIds: [DOCS_UPGRADE_ID, DOCS_GROUP_ID],
			});
			const wrong = await call("reorder_docs_pages", { homeId: DOCS_HOME_ID, orderedIds: [DOCS_UPGRADE_ID] });

			expect(moved).toEqual({ isError: false, text: "Set the new order of the 2 pages at the top of the docs." });
			expect(wrong.isError).toBe(true);
			expect(wrong.text).toBe("The pages changed while you were moving them. Refresh and try again.");
		});

		it("refuses to delete a group that still has pages, and deletes an empty page", async () => {
			const refused = await call("delete_docs_page", { pageId: DOCS_GROUP_ID });
			const deleted = await call("delete_docs_page", { pageId: DOCS_UPGRADE_ID });

			expect(refused.isError).toBe(true);
			expect(refused.text).toBe("Move or delete the pages under this one first.");
			expect(deleted).toEqual({ isError: false, text: "Deleted it. The sidebar no longer lists it." });
			expect(api.rows.has(DOCS_UPGRADE_ID)).toBe(false);
		});
	});

	describe("reading and writing a page's text", () => {
		it("reads the title, description, version and MDX as plain lines, with the MDX last", async () => {
			const result = await call("read_docs_page", { pageId: DOCS_INSTALL_ID });

			expect(result.isError).toBe(false);
			expect(result.text).toBe(
				[
					"Title: Install",
					"Description: Get it running.",
					"Status: draft",
					"Version: 3 (send this as expectedVersion when you write the page)",
					"Blocks with no MDX form: none",
					"",
					"MDX:",
					"## Requirements\n\nDocker.\n",
				].join("\n"),
			);
		});

		it("names the blocks a write would drop, before the agent writes", async () => {
			const install = api.rows.get(DOCS_INSTALL_ID);
			if (install) install.skipped = ["docs/callout-legacy"];

			const result = await call("read_docs_page", { pageId: DOCS_INSTALL_ID });

			expect(result.text).toContain("Blocks with no MDX form, which writing the page drops: docs/callout-legacy");
		});

		it("saves the whole text as a new version, says it is still a draft, and says how to publish", async () => {
			const result = await call("write_docs_page", {
				pageId: DOCS_INSTALL_ID,
				mdx: "## Setup\n\nRun the installer.\n",
				expectedVersion: 3,
				description: "Set it up in five minutes.",
			});

			expect(result.isError).toBe(false);
			expect(result.text).toBe(
				"Saved as version 4. The page is still a draft. Publish it with publish_page, using version 4, only when the owner asks.",
			);
			expect(api.rows.get(DOCS_INSTALL_ID)).toMatchObject({
				version: 4,
				mdx: "## Setup\n\nRun the installer.\n",
				description: "Set it up in five minutes.",
			});
		});

		it("refuses broken MDX, names the line to fix, and saves nothing", async () => {
			const before = { mdx: api.rows.get(DOCS_INSTALL_ID)?.mdx, version: api.rows.get(DOCS_INSTALL_ID)?.version };

			const result = await call("write_docs_page", {
				pageId: DOCS_INSTALL_ID,
				mdx: "Hello\n\n<Callout>\nnever closed\n",
				expectedVersion: 3,
			});

			expect(result.isError).toBe(true);
			expect(result.text).toMatch(/^Nothing was saved\. Line 3: A <Callout> is never closed\. Add <\/Callout> after its text\./);
			expect(result.text).toContain("Fix that line, then send the whole page again with write_docs_page.");
			expect(api.rows.get(DOCS_INSTALL_ID)).toMatchObject(before);
		});

		it("refuses a version that is no longer current, tells the agent to read again, and saves nothing", async () => {
			const before = api.rows.get(DOCS_INSTALL_ID)?.mdx;

			const result = await call("write_docs_page", { pageId: DOCS_INSTALL_ID, mdx: "New text.\n", expectedVersion: 1 });

			expect(result.isError).toBe(true);
			expect(result.text).toBe(
				"Nothing was saved. The page changed somewhere else since you read it. Read it again with read_docs_page, put your change into the new text, and write it with the new version.",
			);
			expect(api.rows.get(DOCS_INSTALL_ID)?.mdx).toBe(before);
		});

		it("recovers from a save made elsewhere: the refused write, read again, then saved", async () => {
			const install = api.rows.get(DOCS_INSTALL_ID);
			const read = await call("read_docs_page", { pageId: DOCS_INSTALL_ID });
			expect(read.text).toContain("Version: 3");
			api.beforeNextSave = () => {
				if (install) {
					install.version += 1;
					install.mdx = "Written in the editor.\n";
				}
			};

			const refused = await call("write_docs_page", { pageId: DOCS_INSTALL_ID, mdx: "Agent text.\n", expectedVersion: 3 });
			const reread = await call("read_docs_page", { pageId: DOCS_INSTALL_ID });
			const saved = await call("write_docs_page", { pageId: DOCS_INSTALL_ID, mdx: "Agent text.\n", expectedVersion: 4 });

			expect(refused.isError).toBe(true);
			expect(refused.text).toContain("The page changed somewhere else since you read it.");
			expect(reread.text).toContain("Version: 4");
			expect(saved).toEqual({
				isError: false,
				text: "Saved as version 5. The page is still a draft. Publish it with publish_page, using version 5, only when the owner asks.",
			});
		});
	});

	describe("failures", () => {
		it("logs a failed read with the tool name, the page id and the server's status", async () => {
			const result = await call("read_docs_page", { pageId: MISSING_PAGE_ID });

			expect(result.isError).toBe(true);
			expect(result.text).toBe("That isn't a docs page. Open it from the docs editor or pick another page.");
			const entry = JSON.parse(logged[0] ?? "{}") as {
				atFunction: string;
				data: { toolName: string; pageId: string };
				error: { status: number };
			};
			expect(entry).toMatchObject({ atFunction: "read_docs_page", data: { toolName: "read_docs_page", pageId: MISSING_PAGE_ID } });
			expect(entry.error.status).toBe(404);
		});

		it("answers a server fault in plain words, and logs the cause", async () => {
			api.failNext = { status: 500, message: "Database is down" };

			const result = await call("read_docs_page", { pageId: DOCS_INSTALL_ID });

			expect(result.isError).toBe(true);
			expect(result.text).toBe("Couldn't finish that. Please try again.");
			expect(result.text).not.toContain("{");
			const entry = JSON.parse(logged[0] ?? "{}") as { error: { message: string; status: number } };
			expect(entry.error).toMatchObject({ message: "Database is down", status: 500 });
		});

		it("logs a refused write with the page it was for, and the line it refused", async () => {
			await call("write_docs_page", { pageId: DOCS_INSTALL_ID, mdx: "<Callout>\n", expectedVersion: 3 });

			const entry = JSON.parse(logged[0] ?? "{}") as { atFunction: string; data: { pageId: string }; error: { status: number } };
			expect(entry).toMatchObject({ atFunction: "write_docs_page", data: { pageId: DOCS_INSTALL_ID } });
			expect(entry.error.status).toBe(400);
		});
	});
});
