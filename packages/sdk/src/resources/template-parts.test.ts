import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";
import { TEMPLATE_ROOT_MESSAGE } from "../types/template-part-root.js";

const PART_ID = "00000000-0000-4000-8000-0000000000a1";
const PAGE_ID = "00000000-0000-4000-8000-0000000000b1";

const partRow = {
	id: PART_ID,
	name: "Main header",
	type: "part",
	other: { usage: "part", siteId: TEST_SITE_ID },
	blocks: [],
};

type BlockLike = {
	id: string;
	name: string;
	type: string;
	parentId: null;
	content: { kind: "empty" };
	children?: BlockLike[];
};

const block = (name: string, children?: BlockLike[]): BlockLike => ({
	id: `id-${name}-${children?.length ?? 0}`,
	name,
	type: children ? "container" : "block",
	parentId: null,
	content: { kind: "empty" },
	...(children ? { children } : {}),
});

describe("templates.listParts", () => {
	it("asks for this site's parts and returns usedOnPages", async () => {
		const page = {
			templates: [{ ...partRow, usedOnPages: 3 }],
			total: 1,
			page: 2,
			per_page: 5,
			total_pages: 1,
		};
		const { client, calls } = createTestClient([
			{ method: "GET", path: "/api/templates", handler: () => Response.json(page) },
		]);

		const result = await client.templates.listParts({ page: 2, per_page: 5 });

		expect(result.templates[0]?.usedOnPages).toBe(3);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/templates",
			query: { usage: "part", siteId: TEST_SITE_ID, page: "2", per_page: "5" },
		});
	});

	it("sends only usage and the client's site when called with no params", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/templates", handler: () => Response.json({ templates: [], total: 0 }) },
		]);

		await client.templates.listParts();

		expect(readCall(calls[0]).query).toEqual({ usage: "part", siteId: TEST_SITE_ID });
	});

	it("lets a call name another site", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/templates", handler: () => Response.json({ templates: [], total: 0 }) },
		]);

		await client.templates.listParts({ siteId: OTHER_SITE_ID });

		expect(readCall(calls[0]).query.siteId).toBe(OTHER_SITE_ID);
	});

	it("fails locally on a bad page size, without calling the server", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.templates.listParts({ per_page: 500 })).rejects.toThrow(
			"Invalid templates.listParts params",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a server refusal into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: "/api/templates",
				handler: () => Response.json({ message: "Site not accessible" }, { status: 403 }),
			},
		]);

		const error = await client.templates.listParts().catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 403, message: "Site not accessible" });
	});
});

describe("templates.createPart", () => {
	const created = () => Response.json(partRow, { status: 201 });

	it("starts as one empty Group when only a name is given", async () => {
		const { client, calls } = createTestClient([
			{ method: "POST", path: "/api/templates", handler: created },
		]);

		const part = await client.templates.createPart({ name: "  Main header  " });

		expect(part.id).toBe(PART_ID);
		expect(calls[0]?.method).toBe("POST");
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/templates",
			query: { siteId: TEST_SITE_ID },
		});
		const body = calls[0]?.body as {
			name: string;
			usage: string;
			type?: string;
			blocks: { name: string; parentId: null; id: string }[];
		};
		expect(body.name).toBe("Main header");
		expect(body.usage).toBe("part");
		expect(body.type).toBeUndefined();
		expect(body.blocks).toHaveLength(1);
		expect(body.blocks[0]).toMatchObject({ name: "core/group", parentId: null });
		expect(body.blocks[0]?.id).toBeTruthy();
	});

	it("starts as the layout block that was asked for", async () => {
		const { client, calls } = createTestClient([{ path: "/api/templates", handler: created }]);

		await client.templates.createPart({ name: "Sign-up", rootBlock: "core/form" });

		const body = calls[0]?.body as { blocks: { name: string }[] };
		expect(body.blocks.map((item) => item.name)).toEqual(["core/form"]);
	});

	it("sends ready-made blocks as they are, with or without the editor's page shell", async () => {
		const { client, calls } = createTestClient([{ path: "/api/templates", handler: created }]);
		const group = block("core/group", [block("core/heading")]);
		const shell = block("core/page-shell", [group]);

		await client.templates.createPart({ name: "Plain", blocks: [group] as never });
		await client.templates.createPart({ name: "Wrapped", blocks: [shell] as never });

		expect((calls[0]?.body as { blocks: BlockLike[] }).blocks).toEqual([group]);
		expect((calls[1]?.body as { blocks: BlockLike[] }).blocks).toEqual([shell]);
	});

	it.each([
		["loose blocks at the top", [block("core/heading"), block("core/paragraph")]],
		["two layout blocks", [block("core/group", []), block("core/stack", [])]],
		["no blocks at all", []],
		["a page shell with nothing inside", [block("core/page-shell", [])]],
		["a block that cannot be a root", [block("core/accordion-item", [])]],
	])("refuses %s before calling the server", async (_label, blocks) => {
		const { client, calls } = createTestClient([]);

		await expect(
			client.templates.createPart({ name: "Bad", blocks: blocks as never }),
		).rejects.toThrow(`Invalid templates.createPart input: blocks: ${TEMPLATE_ROOT_MESSAGE}`);
		expect(calls).toHaveLength(0);
	});

	it("refuses blocks together with a rootBlock, a blank name and an unknown root", async () => {
		const { client, calls } = createTestClient([]);
		const group = block("core/group", []);

		await expect(
			client.templates.createPart({
				name: "Both",
				blocks: [group] as never,
				rootBlock: "core/stack",
			}),
		).rejects.toThrow("rootBlock: Give either blocks or rootBlock, not both.");
		await expect(client.templates.createPart({ name: "   " })).rejects.toThrow(
			"Invalid templates.createPart input: name",
		);
		await expect(
			client.templates.createPart({ name: "Odd", rootBlock: "core/heading" as never }),
		).rejects.toThrow("Invalid templates.createPart input: rootBlock");
		expect(calls).toHaveLength(0);
	});

	it("turns the server's refusal into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: "/api/templates",
				handler: () => Response.json({ message: TEMPLATE_ROOT_MESSAGE }, { status: 400 }),
			},
		]);

		const error = await client.templates
			.createPart({ name: "Header" })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 400, message: TEMPLATE_ROOT_MESSAGE });
	});
});

describe("templates.usage", () => {
	it("returns the pages that show the part", async () => {
		const usage = { pages: [{ id: PAGE_ID, title: "Home", status: "publish" }] };
		const { client, calls } = createTestClient([
			{
				method: "GET",
				path: `/api/templates/${PART_ID}/usage`,
				handler: () => Response.json(usage),
			},
		]);

		const result = await client.templates.usage({ id: PART_ID });

		expect(result).toEqual(usage);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({
			pathname: `/api/templates/${PART_ID}/usage`,
			query: { siteId: TEST_SITE_ID },
		});
	});

	it("fails locally on an id that is not a UUID", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.templates.usage({ id: "main-header" })).rejects.toThrow(
			"Invalid templates.usage id",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a missing template into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: `/api/templates/${PART_ID}/usage`,
				handler: () => Response.json({ message: "Template not found" }, { status: 404 }),
			},
		]);

		const error = await client.templates.usage({ id: PART_ID }).catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404, message: "Template not found" });
	});
});

describe("templates (existing methods)", () => {
	it("list still asks for pre-designed blocks with no usage filter", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/templates", handler: () => Response.json({ templates: [], total: 0 }) },
		]);

		await client.templates.list({ type: "header" });

		expect(readCall(calls[0]).query).toEqual({ type: "header", siteId: TEST_SITE_ID });
	});
});
