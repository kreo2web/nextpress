import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import {
	createTestClient,
	OTHER_SITE_ID,
	readCall,
	TEST_SITE_ID,
} from "../test/create-test-client.js";

const SUBMISSION_ID = "00000000-0000-4000-8000-0000000000d1";
const PAGE_ID = "00000000-0000-4000-8000-0000000000d2";

const submission = {
	id: SUBMISSION_ID,
	siteId: TEST_SITE_ID,
	pageId: PAGE_ID,
	formName: "Contact",
	fields: [{ name: "email", label: "Email", value: "ada@example.com" }],
	status: "new",
	createdAt: "2026-10-01T10:00:00.000Z",
};

const CSV =
	'"Sent","Form","Page","Status","Email"\n"2026-10-01T10:00:00.000Z","Contact","Home","new","ada@example.com"';

describe("forms.submissions.list", () => {
	it("passes the filters and returns the list as the server sent it", async () => {
		const list = {
			items: [submission],
			total: 41,
			formNames: ["Contact", "Newsletter"],
			unread: 7,
			page: 2,
			perPage: 20,
			pageTitles: { [PAGE_ID]: "Home" },
		};
		const { client, calls } = createTestClient([
			{ method: "GET", path: "/api/forms/submissions", handler: () => Response.json(list) },
		]);

		const result = await client.forms.submissions.list({
			page: 2,
			per_page: 20,
			form: "Contact",
			status: "new",
		});

		expect(result).toEqual(list);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/forms/submissions",
			query: { siteId: TEST_SITE_ID, page: "2", per_page: "20", form: "Contact", status: "new" },
		});
	});

	it("sends only the client's site when called with no params, and lets a call name another", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/forms/submissions", handler: () => Response.json({ items: [], total: 0 }) },
		]);

		await client.forms.submissions.list();
		await client.forms.submissions.list({ siteId: OTHER_SITE_ID });

		expect(readCall(calls[0]).query).toEqual({ siteId: TEST_SITE_ID });
		expect(readCall(calls[1]).query).toEqual({ siteId: OTHER_SITE_ID });
	});

	it.each([
		["a status the server does not know", { status: "archived" as never }],
		["a page size above 100", { per_page: 101 }],
		["page 0", { page: 0 }],
		["an empty form name", { form: "" }],
	])("fails locally on %s", async (_label, params) => {
		const { client, calls } = createTestClient([]);

		await expect(client.forms.submissions.list(params)).rejects.toThrow(
			"Invalid forms.submissions.list params",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a server refusal into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: "/api/forms/submissions",
				handler: () => Response.json({ message: "Site not accessible" }, { status: 403 }),
			},
		]);

		const error = await client.forms.submissions.list().catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 403, message: "Site not accessible" });
	});
});

describe("forms.submissions.exportCsv", () => {
	const csvResponse = () =>
		new Response(CSV, {
			headers: {
				"content-type": "text/csv; charset=utf-8",
				"content-disposition": 'attachment; filename="contact-submissions.csv"',
			},
		});

	it("returns the CSV text for one form", async () => {
		const { client, calls } = createTestClient([
			{ method: "GET", path: "/api/forms/submissions/export", handler: csvResponse },
		]);

		const csv = await client.forms.submissions.exportCsv({ form: "Contact" });

		expect(csv).toBe(CSV);
		expect(calls[0]?.method).toBe("GET");
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/forms/submissions/export",
			query: { siteId: TEST_SITE_ID, form: "Contact" },
		});
	});

	it("exports every form when none is named", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/forms/submissions/export", handler: csvResponse },
		]);

		await client.forms.submissions.exportCsv();

		expect(readCall(calls[0]).query).toEqual({ siteId: TEST_SITE_ID });
	});

	it("fails locally on an empty form name", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.forms.submissions.exportCsv({ form: "" })).rejects.toThrow(
			"Invalid forms.submissions.exportCsv params",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a server fault into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path: "/api/forms/submissions/export",
				handler: () =>
					Response.json({ message: "Something went wrong. Please try again." }, { status: 500 }),
			},
		]);

		const error = await client.forms.submissions.exportCsv().catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({
			status: 500,
			message: "Something went wrong. Please try again.",
		});
	});
});

describe("forms.submissions.markStatus", () => {
	const path = `/api/forms/submissions/${SUBMISSION_ID}`;

	it("sends the new status and returns the updated answer", async () => {
		const { client, calls } = createTestClient([
			{ method: "PATCH", path, handler: () => Response.json({ ...submission, status: "read" }) },
		]);

		const result = await client.forms.submissions.markStatus({ id: SUBMISSION_ID, status: "read" });

		expect(result.status).toBe("read");
		expect(calls[0]?.method).toBe("PATCH");
		expect(calls[0]?.body).toEqual({ status: "read" });
		expect(readCall(calls[0])).toEqual({ pathname: path, query: { siteId: TEST_SITE_ID } });
	});

	it.each([
		["a status other than new or read", { id: SUBMISSION_ID, status: "unread" as never }, "status"],
		["an id that is not a UUID", { id: "latest", status: "read" as const }, "id"],
	])("fails locally on %s", async (_label, input, detail) => {
		const { client, calls } = createTestClient([]);

		await expect(client.forms.submissions.markStatus(input)).rejects.toThrow(
			`Invalid forms.submissions.markStatus input: ${detail}`,
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a missing answer into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path,
				handler: () =>
					Response.json({ message: "That submission no longer exists." }, { status: 404 }),
			},
		]);

		const error = await client.forms.submissions
			.markStatus({ id: SUBMISSION_ID, status: "read" })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404, message: "That submission no longer exists." });
	});
});

describe("forms.submissions.delete", () => {
	const path = `/api/forms/submissions/${SUBMISSION_ID}`;

	it("deletes one answer and resolves with nothing", async () => {
		const { client, calls } = createTestClient([
			{ method: "DELETE", path, handler: () => new Response(null, { status: 204 }) },
		]);

		await expect(client.forms.submissions.delete({ id: SUBMISSION_ID })).resolves.toBeUndefined();

		expect(calls[0]?.method).toBe("DELETE");
		expect(readCall(calls[0])).toEqual({ pathname: path, query: { siteId: TEST_SITE_ID } });
	});

	it("fails locally on an id that is not a UUID", async () => {
		const { client, calls } = createTestClient([]);

		await expect(client.forms.submissions.delete({ id: "all" })).rejects.toThrow(
			"Invalid forms.submissions.delete id",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns a missing answer into a NextpressError", async () => {
		const { client } = createTestClient([
			{
				path,
				handler: () =>
					Response.json({ message: "That submission no longer exists." }, { status: 404 }),
			},
		]);

		const error = await client.forms.submissions
			.delete({ id: SUBMISSION_ID })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 404 });
	});
});
