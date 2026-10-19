import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";

const FIRST_ID = "00000000-0000-4000-8000-0000000000f1";
const SECOND_ID = "00000000-0000-4000-8000-0000000000f2";

const items = [
	{ id: FIRST_ID, menuOrder: 0 },
	{ id: SECOND_ID, menuOrder: 1 },
];

describe("pages.reorder", () => {
	it("patches the menu order with the client's site in the body, where the server reads it", async () => {
		const { client, calls } = createTestClient([
			{
				method: "PATCH",
				path: "/api/pages/reorder",
				handler: () => Response.json({ ok: true, updated: 2 }),
			},
		]);

		const result = await client.pages.reorder({ items });

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.value).toEqual({ ok: true, updated: 2 });
		expect(calls[0]?.method).toBe("PATCH");
		expect(calls[0]?.body).toEqual({ siteId: TEST_SITE_ID, items });
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/pages/reorder",
			query: { siteId: TEST_SITE_ID },
		});
	});

	it("lets a call name another site", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/pages/reorder", handler: () => Response.json({ ok: true, updated: 2 }) },
		]);

		await client.pages.reorder({ items, siteId: OTHER_SITE_ID });

		expect((calls[0]?.body as { siteId: string }).siteId).toBe(OTHER_SITE_ID);
		expect(readCall(calls[0]).query.siteId).toBe(TEST_SITE_ID);
	});

	it.each([
		["no pages", { items: [] }],
		[
			"more than 100 pages",
			{ items: Array.from({ length: 101 }, (_, menuOrder) => ({ id: FIRST_ID, menuOrder })) },
		],
		["a page id that is not a UUID", { items: [{ id: "about", menuOrder: 0 }] }],
		["a negative position", { items: [{ id: FIRST_ID, menuOrder: -1 }] }],
		["a position that is not a whole number", { items: [{ id: FIRST_ID, menuOrder: 1.5 }] }],
		["a site id that is not a UUID", { items, siteId: "main" }],
	])("fails locally on %s, without calling the server", async (_label, input) => {
		const { client, calls } = createTestClient([]);

		await expect(client.pages.reorder(input)).rejects.toThrow("Invalid pages.reorder input");
		expect(calls).toHaveLength(0);
	});

	it("returns a page from another site as an error value, not a throw", async () => {
		const message = "One or more pages are not accessible on this site";
		const { client } = createTestClient([
			{ path: "/api/pages/reorder", handler: () => Response.json({ message }, { status: 403 }) },
		]);

		const result = await client.pages.reorder({ items });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(isNextpressError(result.error)).toBe(true);
		expect(result.error).toMatchObject({ status: 403, message });
	});
});
