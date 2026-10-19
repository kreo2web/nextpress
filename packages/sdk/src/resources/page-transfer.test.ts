import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";

const PAGE_ID = "00000000-0000-4000-8000-0000000000c1";
const LINKED_ID = "00000000-0000-4000-8000-0000000000c2";
const OTHER_LINKED_ID = "00000000-0000-4000-8000-0000000000c3";

const exportPath = `/api/page-transfer/pages/${PAGE_ID}/export`;

/** Bytes that are not valid UTF-8, so any text decoding along the way would change them. */
const BINARY = new Uint8Array([0x7b, 0x00, 0xff, 0xfe, 0x80, 0x0d, 0x0a, 0x7d]);

const fileResponse = ({
	headers = {},
	bytes = BINARY,
}: {
	headers?: Record<string, string>;
	bytes?: Uint8Array;
} = {}) =>
	new Response(bytes, {
		headers: {
			"content-type": "application/json",
			"content-disposition": 'attachment; filename="about.nextpress-page.json"',
			...headers,
		},
	});

describe("pageTransfer.links", () => {
	it("lists the linked pages of a page", async () => {
		const links = {
			pages: [
				{
					id: LINKED_ID,
					title: "Contact",
					slug: "contact",
					status: "publish",
					depth: 1,
					isHomepage: false,
					linkedFrom: "About",
				},
			],
			missing: ["/terms"],
		};
		const { client, calls } = createTestClient([
			{
				method: "GET",
				path: `/api/page-transfer/pages/${PAGE_ID}/links`,
				handler: () => Response.json(links),
			},
		]);

		const result = await client.pageTransfer.links({ pageId: PAGE_ID });

		expect(result).toEqual(links);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({
			pathname: `/api/page-transfer/pages/${PAGE_ID}/links`,
			query: { siteId: TEST_SITE_ID },
		});
	});

	it("fails locally on a page id that is not a UUID", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.pageTransfer.links({ pageId: "about" })).rejects.toThrow(
			"Invalid pageTransfer.links input",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a missing page into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: `/api/page-transfer/pages/${PAGE_ID}/links`,
				handler: () => Response.json({ message: "This page no longer exists." }, { status: 404 }),
			},
		]);

		const error = await client.pageTransfer
			.links({ pageId: PAGE_ID })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404, message: "This page no longer exists." });
	});
});

describe("pageTransfer.export", () => {
	it("returns the file's bytes untouched, with its name and content type", async () => {
		const { client, calls } = createTestClient([
			{ method: "GET", path: exportPath, handler: () => fileResponse() },
		]);

		const file = await client.pageTransfer.export({ pageId: PAGE_ID });

		expect(file.bytes).toBeInstanceOf(Uint8Array);
		expect(Array.from(file.bytes)).toEqual(Array.from(BINARY));
		expect(file.fileName).toBe("about.nextpress-page.json");
		expect(file.contentType).toBe("application/json");
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({ pathname: exportPath, query: { siteId: TEST_SITE_ID } });
	});

	it("keeps the whole JSON page file readable", async () => {
		const text = JSON.stringify({ format: "nextpress-page", blocks: [] });
		const { client } = createTestClient([
			{ path: exportPath, handler: () => fileResponse({ bytes: new TextEncoder().encode(text) }) },
		]);

		const file = await client.pageTransfer.export({ pageId: PAGE_ID });

		expect(JSON.parse(new TextDecoder().decode(file.bytes))).toEqual({
			format: "nextpress-page",
			blocks: [],
		});
	});

	it("sends files as 1 or 0, because the server only skips files for the text 0", async () => {
		const { client, calls } = createTestClient([
			{ path: exportPath, handler: () => fileResponse() },
		]);

		await client.pageTransfer.export({ pageId: PAGE_ID, files: false });
		await client.pageTransfer.export({ pageId: PAGE_ID, files: true });

		expect(readCall(calls[0]).query.files).toBe("0");
		expect(readCall(calls[1]).query.files).toBe("1");
	});

	it("sends the chosen linked pages as one comma list, and nothing for an empty list", async () => {
		const { client, calls } = createTestClient([
			{ path: exportPath, handler: () => fileResponse() },
		]);

		await client.pageTransfer.export({ pageId: PAGE_ID, include: [LINKED_ID, OTHER_LINKED_ID] });
		await client.pageTransfer.export({ pageId: PAGE_ID, include: [] });

		expect(readCall(calls[0]).query.include).toBe(`${LINKED_ID},${OTHER_LINKED_ID}`);
		expect(readCall(calls[1]).query).toEqual({ siteId: TEST_SITE_ID });
	});

	it("uses a plain file name when the server sends none, and drops folders from a sent one", async () => {
		const { client } = createTestClient([
			{ path: exportPath, handler: () => fileResponse({ headers: { "content-disposition": "" } }) },
			{
				path: `/api/page-transfer/pages/${LINKED_ID}/export`,
				handler: () =>
					fileResponse({
						headers: { "content-disposition": 'attachment; filename="../../etc/evil.json"' },
					}),
			},
		]);

		const unnamed = await client.pageTransfer.export({ pageId: PAGE_ID });
		const sneaky = await client.pageTransfer.export({ pageId: LINKED_ID });

		expect(unnamed.fileName).toBe("page.nextpress-page.json");
		expect(sneaky.fileName).toBe("evil.json");
	});

	it.each([
		["a page id that is not a UUID", { pageId: "about" }],
		[
			"more than 50 linked pages",
			{ pageId: PAGE_ID, include: Array.from({ length: 51 }, () => LINKED_ID) },
		],
		["a linked page id that is not a UUID", { pageId: PAGE_ID, include: ["contact"] }],
		["files that is not true or false", { pageId: PAGE_ID, files: "no" as never }],
	])("fails locally on %s", async (_label, input) => {
		const { client, calls } = createTestClient([]);

		await expect(client.pageTransfer.export(input)).rejects.toThrow(
			"Invalid pageTransfer.export input",
		);
		expect(calls).toHaveLength(0);
	});

	it("says how many linked pages are allowed", async () => {
		const { client } = createTestClient([]);

		await expect(
			client.pageTransfer.export({
				pageId: PAGE_ID,
				include: Array.from({ length: 51 }, () => LINKED_ID),
			}),
		).rejects.toThrow("Choose at most 50 linked pages.");
	});

	it("turns a server refusal into a NextpressError instead of a file", async () => {
		const message = "Too many page moves at once. Wait a minute and try again.";
		const { client } = createTestClient([
			{ path: exportPath, handler: () => Response.json({ message }, { status: 429 }) },
		]);

		const error = await client.pageTransfer
			.export({ pageId: PAGE_ID })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 429, message });
	});
});

describe("pageTransfer.import", () => {
	const imported = {
		page: { id: PAGE_ID, title: "About", slug: "about", status: "draft", siteId: TEST_SITE_ID },
		pages: [{ id: PAGE_ID, title: "About", slug: "about" }],
		renamed: [],
		files: { refMap: {}, added: [], reused: [], missing: [] },
		theme: { status: "none" },
	};
	const importRoute = {
		method: "POST",
		path: "/api/page-transfer/import",
		handler: () => Response.json(imported, { status: 201 }),
	};

	it("sends the file as multipart field `package`, with no JSON content type", async () => {
		const { client, calls } = createTestClient([importRoute]);

		const result = await client.pageTransfer.import({
			file: BINARY,
			fileName: "about.nextpress-page.json",
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.value.page.id).toBe(PAGE_ID);
		expect(calls[0]?.method).toBe("POST");
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/page-transfer/import",
			query: { siteId: TEST_SITE_ID },
		});
		expect(calls[0]?.headers["content-type"]).toBeUndefined();
		expect(calls[0]?.headers.authorization).toBe("Bearer np_test_key");

		const form = calls[0]?.body as FormData;
		expect(form).toBeInstanceOf(FormData);
		const part = form.get("package") as File;
		expect(part.name).toBe("about.nextpress-page.json");
		expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual(Array.from(BINARY));
		expect(form.has("includeTheme")).toBe(false);
	});

	it("accepts a File, a Blob and the file's JSON text", async () => {
		const { client, calls } = createTestClient([importRoute]);
		const text = '{"format":"nextpress-page"}';

		await client.pageTransfer.import({
			file: new File([text], "a.json"),
			fileName: "from-file.json",
		});
		await client.pageTransfer.import({ file: new Blob([text]), fileName: "from-blob.json" });
		await client.pageTransfer.import({ file: text, fileName: "from-text.json" });

		for (const [index, name] of ["from-file.json", "from-blob.json", "from-text.json"].entries()) {
			const part = (calls[index]?.body as FormData).get("package") as File;
			expect(part.name).toBe(name);
			expect(await part.text()).toBe(text);
		}
	});

	it("sends includeTheme as the text true, and only when asked", async () => {
		const { client, calls } = createTestClient([importRoute]);

		await client.pageTransfer.import({ file: BINARY, fileName: "a.json", includeTheme: true });
		await client.pageTransfer.import({ file: BINARY, fileName: "b.json", includeTheme: false });

		expect((calls[0]?.body as FormData).get("includeTheme")).toBe("true");
		expect((calls[1]?.body as FormData).has("includeTheme")).toBe(false);
	});

	it("brings the page into the site that was named", async () => {
		const { client, calls } = createTestClient([importRoute]);

		await client.pageTransfer.import({ file: BINARY, fileName: "a.json", siteId: OTHER_SITE_ID });

		expect(readCall(calls[0]).query).toEqual({ siteId: OTHER_SITE_ID });
	});

	it("moves a page from export straight into import", async () => {
		const { client, calls } = createTestClient([
			{ path: exportPath, handler: () => fileResponse() },
			importRoute,
		]);

		const file = await client.pageTransfer.export({ pageId: PAGE_ID, files: false });
		await client.pageTransfer.import({ file: file.bytes, fileName: file.fileName });

		const part = (calls[1]?.body as FormData).get("package") as File;
		expect(part.name).toBe("about.nextpress-page.json");
		expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual(Array.from(BINARY));
	});

	it.each([
		["an empty file", { file: new Uint8Array(0), fileName: "a.json" }, "The page file is empty."],
		["empty text", { file: "", fileName: "a.json" }, "The page file is empty."],
		["an empty Blob", { file: new Blob([]), fileName: "a.json" }, "The page file is empty."],
		["a blank file name", { file: BINARY, fileName: "  " }, "fileName"],
		[
			"a site id that is not a UUID",
			{ file: BINARY, fileName: "a.json", siteId: "main" },
			"siteId",
		],
		["a file that is not bytes, a Blob or text", { file: 42 as never, fileName: "a.json" }, "file"],
	])("fails locally on %s", async (_label, input, detail) => {
		const { client, calls } = createTestClient([]);

		await expect(client.pageTransfer.import(input)).rejects.toThrow(
			`Invalid pageTransfer.import input`,
		);
		await expect(client.pageTransfer.import(input)).rejects.toThrow(detail);
		expect(calls).toHaveLength(0);
	});

	it("returns a refused file as an error value, not a throw", async () => {
		const message = "This page file couldn't be read. Export it again and try once more.";
		const { client } = createTestClient([
			{
				path: "/api/page-transfer/import",
				handler: () => Response.json({ message }, { status: 400 }),
			},
		]);

		const result = await client.pageTransfer.import({ file: BINARY, fileName: "a.json" });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(isNextpressError(result.error)).toBe(true);
		expect(result.error).toMatchObject({ status: 400, message });
	});
});
