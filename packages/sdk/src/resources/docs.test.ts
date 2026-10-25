import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";
import { docsSettings, docsTree, HOME_ID, PAGE_ID, refusal } from "../test/docs-fixtures.js";

const created = {
	docs: {
		homeId: HOME_ID,
		siteId: TEST_SITE_ID,
		name: "Acme Docs",
		path: "/docs",
		pageCount: 1,
		searchOn: true,
		status: "draft",
	},
	homeId: HOME_ID,
};

describe("docs.list", () => {
	it("lists the docs of the client's site", async () => {
		const docs = [created.docs];
		const { client, calls } = createTestClient([
			{ method: "GET", path: "/api/docs", handler: () => Response.json({ docs }) },
		]);

		const result = await client.docs.list();

		expect(result).toEqual({ docs });
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({ pathname: "/api/docs", query: { siteId: TEST_SITE_ID } });
	});

	it("lets a call name another site", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/docs", handler: () => Response.json({ docs: [] }) },
		]);

		await client.docs.list({ siteId: OTHER_SITE_ID });

		expect(readCall(calls[0]).query.siteId).toBe(OTHER_SITE_ID);
	});

	it("turns a refusal into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: "/api/docs",
				handler: refusal("This API key cannot access the requested site", 403),
			},
		]);

		const error = await client.docs.list().catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({
			status: 403,
			message: "This API key cannot access the requested site",
		});
	});
});

describe("docs.create", () => {
	it("makes a docs on the client's site, with the address made from the name when none is given", async () => {
		const { client, calls } = createTestClient([
			{
				method: "POST",
				path: "/api/docs",
				handler: () => Response.json(created, { status: 201 }),
			},
		]);

		const result = await client.docs.create({ name: "Acme Docs" });

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.value.homeId).toBe(HOME_ID);
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.body).toEqual({ siteId: TEST_SITE_ID, name: "Acme Docs", slug: "" });
	});

	it("sends the address, search switch and features it was given", async () => {
		const { client, calls } = createTestClient([
			{
				method: "POST",
				path: "/api/docs",
				handler: () => Response.json(created, { status: 201 }),
			},
		]);

		await client.docs.create({
			name: "Acme Docs",
			slug: "docs",
			search: false,
			features: { toc: false },
			siteId: OTHER_SITE_ID,
		});

		expect(calls[0]?.body).toEqual({
			siteId: OTHER_SITE_ID,
			name: "Acme Docs",
			slug: "docs",
			search: false,
			features: { toc: false },
		});
	});

	it.each([
		["a blank name", { name: "   " }, "name"],
		["an address longer than 200 characters", { name: "Acme", slug: "a".repeat(201) }, "slug"],
	])("fails locally on %s, without calling the server", async (_label, input, detail) => {
		const { client, calls } = createTestClient([]);

		await expect(client.docs.create(input)).rejects.toThrow(`Invalid docs.create input: ${detail}`);
		expect(calls).toHaveLength(0);
	});

	it("returns a refused creation as an error value, not a throw", async () => {
		const { client } = createTestClient([
			{ path: "/api/docs", handler: refusal("Give your docs a name.", 400) },
		]);

		const result = await client.docs.create({ name: "Acme" });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(isNextpressError(result.error)).toBe(true);
		expect(result.error).toMatchObject({ status: 400, message: "Give your docs a name." });
	});
});

describe("docs.tree and docs.treeOfPage", () => {
	it("reads the navigation tree and settings of a docs", async () => {
		const { client, calls } = createTestClient([
			{
				method: "GET",
				path: `/api/docs/${HOME_ID}/tree`,
				handler: () => Response.json(docsTree),
			},
		]);

		const result = await client.docs.tree({ homeId: HOME_ID });

		expect(result).toEqual(docsTree);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0]).pathname).toBe(`/api/docs/${HOME_ID}/tree`);
	});

	it("reads the docs a page sits in", async () => {
		const { client, calls } = createTestClient([
			{
				method: "GET",
				path: `/api/docs/items/${PAGE_ID}`,
				handler: () => Response.json(docsTree),
			},
		]);

		const result = await client.docs.treeOfPage({ pageId: PAGE_ID });

		expect(result.home.id).toBe(HOME_ID);
		expect(readCall(calls[0]).pathname).toBe(`/api/docs/items/${PAGE_ID}`);
	});

	it("throws a NextpressError when the docs is gone", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/${HOME_ID}/tree`,
				handler: refusal("These docs no longer exist.", 404),
			},
		]);

		const error = await client.docs.tree({ homeId: HOME_ID }).catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404, message: "These docs no longer exist." });
	});

	it("fails locally on an id that is not a UUID, without calling the server", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.docs.tree({ homeId: "docs" })).rejects.toThrow("Invalid docs.tree homeId");
		expect(calls).toHaveLength(0);
	});
});

describe("docs.updateSettings", () => {
	it("sends only the fields given to the docs home's settings", async () => {
		const saved = { ...docsSettings, title: "Acme" };
		const { client, calls } = createTestClient([
			{
				method: "PUT",
				path: `/api/docs/${HOME_ID}/settings`,
				handler: () => Response.json({ settings: saved }),
			},
		]);

		const result = await client.docs.updateSettings({
			homeId: HOME_ID,
			title: "Acme",
			features: { toc: false },
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.value.settings.title).toBe("Acme");
		expect(calls[0]?.method).toBe("PUT");
		expect(calls[0]?.body).toEqual({ title: "Acme", features: { toc: false } });
	});

	it("sends the header links, button and search wording", async () => {
		const { client, calls } = createTestClient([
			{
				path: `/api/docs/${HOME_ID}/settings`,
				handler: () => Response.json({ settings: docsSettings }),
			},
		]);

		await client.docs.updateSettings({
			homeId: HOME_ID,
			links: [{ label: "GitHub", url: "https://github.com/acme" }],
			button: { label: "Get started", url: "/docs/install" },
			search: { placeholder: "Find anything" },
		});

		expect(calls[0]?.body).toEqual({
			links: [{ label: "GitHub", url: "https://github.com/acme" }],
			button: { label: "Get started", url: "/docs/install" },
			search: { placeholder: "Find anything" },
		});
	});

	it("refuses more than six header links, without calling the server", async () => {
		const { client, calls } = createTestClient([]);
		const links = Array.from({ length: 7 }, (_, index) => ({ label: `Link ${index}`, url: "/x" }));

		await expect(client.docs.updateSettings({ homeId: HOME_ID, links })).rejects.toThrow(
			"Invalid docs.updateSettings input: links",
		);
		expect(calls).toHaveLength(0);
	});

	it("returns a refused change as an error value", async () => {
		const { client } = createTestClient([
			{
				path: `/api/docs/${HOME_ID}/settings`,
				handler: refusal("You may not change this docs.", 403),
			},
		]);

		const result = await client.docs.updateSettings({ homeId: HOME_ID, title: "Acme" });

		expect(result.isErr).toBe(true);
		if (!result.isErr) return;
		expect(result.error).toMatchObject({ status: 403, message: "You may not change this docs." });
	});
});
