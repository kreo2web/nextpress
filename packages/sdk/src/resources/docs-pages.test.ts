import { afterEach, describe, expect, it, vi } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import { VERSION_STALE } from "../client/sdk-result.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";
import { HOME_ID, OTHER_PAGE_ID, PAGE_ID, refusal } from "../test/docs-fixtures.js";
import { readDocsMdxProblem } from "./docs.js";

const BINARY = new Uint8Array([0x7b, 0x00, 0xff, 0xfe, 0x80, 0x0d, 0x0a, 0x7d]);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("docs.readPage", () => {
	const page = {
		pageId: PAGE_ID,
		title: "Install",
		description: "Get it running.",
		mdx: "## Requirements\n\nDocker.\n",
		version: 3,
		status: "draft",
		skipped: ["docs/callout-legacy"],
	};

	it("reads a page as MDX, with the version, title, description and the blocks MDX leaves out", async () => {
		const { client, calls } = createTestClient([
			{ method: "GET", path: `/api/docs/pages/${PAGE_ID}/mdx`, handler: () => Response.json(page) },
		]);

		const result = await client.docs.readPage({ pageId: PAGE_ID });

		expect(result).toEqual(page);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0]).pathname).toBe(`/api/docs/pages/${PAGE_ID}/mdx`);
	});

	it("throws a NextpressError for a page that is not in any docs", async () => {
		const { client } = createTestClient([
			{ path: `/api/docs/pages/${PAGE_ID}/mdx`, handler: refusal("That isn't a docs page.", 404) },
		]);

		const error = await client.docs.readPage({ pageId: PAGE_ID }).catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404, message: "That isn't a docs page." });
	});
});

describe("docs.writePage", () => {
	const text = "## Before you start\n\nYou need Docker.\n";

	it("sends the MDX with the version it read, and returns the new version", async () => {
		const { client, calls } = createTestClient([
			{
				method: "PUT",
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: () => Response.json({ ok: true, version: 4 }),
			},
		]);

		const result = await client.docs.writePage({
			pageId: PAGE_ID,
			mdx: text,
			expectedVersion: 3,
			description: "Get it running.",
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.value).toEqual({ ok: true, version: 4 });
		expect(calls[0]?.method).toBe("PUT");
		expect(calls[0]?.body).toEqual({
			mdx: text,
			expectedVersion: 3,
			description: "Get it running.",
		});
	});

	it("leaves out the title and description when they are not given", async () => {
		const { client, calls } = createTestClient([
			{
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: () => Response.json({ ok: true, version: 1 }),
			},
		]);

		await client.docs.writePage({ pageId: PAGE_ID, mdx: text, expectedVersion: 0 });

		expect(calls[0]?.body).toEqual({ mdx: text, expectedVersion: 0 });
	});

	it("refuses broken MDX as an error value, and says which line to fix", async () => {
		const message = "A <Callout> is never closed. Add </Callout> after its text.";
		const { client } = createTestClient([
			{
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: () => Response.json({ ok: false, message, line: 3 }, { status: 400 }),
			},
		]);

		const result = await client.docs.writePage({
			pageId: PAGE_ID,
			mdx: "Hello\n\n<Callout>\nnever closed\n",
			expectedVersion: 0,
		});

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(result.error).toMatchObject({ status: 400 });
		expect(readDocsMdxProblem(result.error)).toEqual({ message, line: 3 });
	});

	it("reads no MDX problem from a 400 that names no line", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: refusal("Keep the title under 200 characters.", 400),
			},
		]);

		const result = await client.docs.writePage({ pageId: PAGE_ID, mdx: text, expectedVersion: 0 });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(result.error).toMatchObject({
			status: 400,
			message: "Keep the title under 200 characters.",
		});
		expect(readDocsMdxProblem(result.error)).toBeNull();
	});

	it("answers a version the page has moved past with VERSION_STALE (409), and warns in the console", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { client } = createTestClient([
			{
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: () =>
					Response.json(
						{
							code: VERSION_STALE,
							message: "The page changed somewhere else. Read it again.",
							remoteVersion: 5,
						},
						{ status: 409 },
					),
			},
		]);

		const result = await client.docs.writePage({ pageId: PAGE_ID, mdx: text, expectedVersion: 3 });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(result.error).toMatchObject({ status: 409, code: VERSION_STALE });
		expect(result.error.body).toMatchObject({ remoteVersion: 5 });
		expect(readDocsMdxProblem(result.error)).toBeNull();
		expect(warn).toHaveBeenCalled();
	});

	it("returns a page of another site (403) and a missing page (404) as error values", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/pages/${OTHER_PAGE_ID}/mdx`,
				handler: refusal("This page is on another site.", 403),
			},
			{
				path: `/api/docs/pages/${PAGE_ID}/mdx`,
				handler: refusal("That page no longer exists.", 404),
			},
		]);

		const forbidden = await client.docs.writePage({
			pageId: OTHER_PAGE_ID,
			mdx: text,
			expectedVersion: 0,
		});
		const missing = await client.docs.writePage({ pageId: PAGE_ID, mdx: text, expectedVersion: 0 });

		expect(forbidden.isErr && forbidden.error.status).toBe(403);
		expect(missing.isErr && missing.error.status).toBe(404);
	});

	it.each([
		["a negative version", { expectedVersion: -1 }, "expectedVersion"],
		["a title longer than 200 characters", { title: "t".repeat(201) }, "title"],
		["a description longer than 1000 characters", { description: "d".repeat(1001) }, "description"],
	])("fails locally on %s, without calling the server", async (_label, extra, detail) => {
		const { client, calls } = createTestClient([]);

		await expect(
			client.docs.writePage({ pageId: PAGE_ID, mdx: text, expectedVersion: 0, ...extra }),
		).rejects.toThrow(`Invalid docs.writePage input: ${detail}`);
		expect(calls).toHaveLength(0);
	});
});

describe("docs.exportFile", () => {
	const fileResponse = (headers: Record<string, string> = {}) =>
		new Response(BINARY, {
			headers: {
				"content-type": "application/json",
				"content-disposition": 'attachment; filename="acme-docs-docs.nextpress-page.json"',
				...headers,
			},
		});

	it("returns the page file's bytes and name, in the shape pageTransfer.import takes", async () => {
		const { client, calls } = createTestClient([
			{ method: "GET", path: `/api/docs/${HOME_ID}/export`, handler: () => fileResponse() },
		]);

		const file = await client.docs.exportFile({ homeId: HOME_ID });

		expect(file.fileName).toBe("acme-docs-docs.nextpress-page.json");
		expect(file.contentType).toBe("application/json");
		expect(Array.from(file.bytes)).toEqual(Array.from(BINARY));
		expect(readCall(calls[0])).toEqual({
			pathname: `/api/docs/${HOME_ID}/export`,
			query: { siteId: TEST_SITE_ID },
		});
	});

	it("sends includeFiles as 1 or 0, because the server only leaves files out for the text 0", async () => {
		const { client, calls } = createTestClient([
			{ path: `/api/docs/${HOME_ID}/export`, handler: () => fileResponse() },
		]);

		await client.docs.exportFile({ homeId: HOME_ID, includeFiles: false });
		await client.docs.exportFile({ homeId: HOME_ID, includeFiles: true });

		expect(readCall(calls[0]).query.files).toBe("0");
		expect(readCall(calls[1]).query.files).toBe("1");
	});

	it("uses a plain file name when the server sends none", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/${HOME_ID}/export`,
				handler: () => fileResponse({ "content-disposition": "" }),
			},
		]);

		const file = await client.docs.exportFile({ homeId: HOME_ID });

		expect(file.fileName).toBe("docs.nextpress-page.json");
	});

	it("hands the exported file to pageTransfer.import on another site, unchanged", async () => {
		const imported = {
			page: {
				id: PAGE_ID,
				title: "Install",
				slug: "install",
				status: "draft",
				siteId: OTHER_SITE_ID,
			},
			pages: [],
			renamed: [],
			files: { refMap: {}, added: [], reused: [], missing: [] },
			theme: { status: "none" },
		};
		const { client, calls } = createTestClient([
			{ path: `/api/docs/${HOME_ID}/export`, handler: () => fileResponse() },
			{
				method: "POST",
				path: "/api/page-transfer/import",
				handler: () => Response.json(imported, { status: 201 }),
			},
		]);

		const file = await client.docs.exportFile({ homeId: HOME_ID });
		const result = await client.pageTransfer.import({
			file: file.bytes,
			fileName: file.fileName,
			siteId: OTHER_SITE_ID,
		});

		expect(result.isOk).toBe(true);
		const part = (calls[1]?.body as FormData).get("package") as File;
		expect(part.name).toBe("acme-docs-docs.nextpress-page.json");
		expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual(Array.from(BINARY));
	});

	it("turns a refusal into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/${HOME_ID}/export`,
				handler: refusal("Too many changes at once. Wait a minute and try again.", 429),
			},
		]);

		const error = await client.docs
			.exportFile({ homeId: HOME_ID })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 429 });
	});
});
