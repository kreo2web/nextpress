import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "./http-client.js";
import { NextpressError } from "./nextpress-error.js";

describe("createHttpClient", () => {
	it("sends Bearer token and parses JSON", async () => {
		const fetchMock = vi.fn(async () => Response.json({ posts: [], total: 0 }));

		const http = createHttpClient({
			baseUrl: "https://cms.example.com",
			apiKey: "np_test_key",
			fetch: fetchMock as typeof fetch,
			timeout: 5000,
		});

		const result = await http.request<{ posts: unknown[]; total: number }>("/api/posts");

		expect(result.total).toBe(0);
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("/api/posts");
		expect(init.headers).toMatchObject({
			Authorization: "Bearer np_test_key",
		});
	});

	it("throws NextpressError on API failure", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json(
				{ message: "Unauthorized", code: "AUTH_REQUIRED" },
				{
					status: 401,
				},
			),
		);

		const http = createHttpClient({
			baseUrl: "https://cms.example.com",
			apiKey: "bad_key",
			fetch: fetchMock as typeof fetch,
			timeout: 5000,
		});

		await expect(http.request("/api/posts")).rejects.toBeInstanceOf(NextpressError);
	});

	it("keeps configured api key when caller passes Authorization header", async () => {
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			const headers = init?.headers as Record<string, string>;
			expect(headers.Authorization).toBe("Bearer real_key");
			return Response.json({ status: "ok", timestamp: "now" });
		});

		const http = createHttpClient({
			baseUrl: "https://cms.example.com",
			apiKey: "real_key",
			fetch: fetchMock as typeof fetch,
			timeout: 5000,
		});

		await http.request("/api/health", {
			headers: { Authorization: "Bearer attacker_key" },
		});
	});

	describe("request bodies", () => {
		const makeClient = (fetchMock: typeof fetch) =>
			createHttpClient({
				baseUrl: "https://cms.example.com",
				apiKey: "np_test_key",
				fetch: fetchMock,
				timeout: 5000,
			});

		it("sends a JSON body with a JSON content type", async () => {
			const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
				Response.json({ ok: true }),
			);

			await makeClient(fetchMock as typeof fetch).request("/api/pages/reorder", {
				method: "PATCH",
				body: { items: [] },
			});

			const init = fetchMock.mock.calls[0]?.[1];
			expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
			expect(init?.body).toBe(JSON.stringify({ items: [] }));
		});

		it("sends FormData as it is, with no content type so fetch can add the multipart boundary", async () => {
			const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
				Response.json({ ok: true }),
			);
			const form = new FormData();
			form.append("package", new Blob(["{}"]), "page.json");

			await makeClient(fetchMock as typeof fetch).request("/api/page-transfer/import", {
				method: "POST",
				body: form,
			});

			const init = fetchMock.mock.calls[0]?.[1];
			expect(init?.body).toBe(form);
			expect(init?.headers).toEqual({ Authorization: "Bearer np_test_key" });
		});
	});

	describe("response types", () => {
		const makeClient = (response: () => Response) =>
			createHttpClient({
				baseUrl: "https://cms.example.com",
				apiKey: "np_test_key",
				fetch: vi.fn(async () => response()) as typeof fetch,
				timeout: 5000,
			});

		it("reads text for a non-JSON response by default", async () => {
			const http = makeClient(
				() => new Response("a,b\n1,2", { headers: { "content-type": "text/csv" } }),
			);

			expect(await http.request<string>("/api/forms/submissions/export")).toBe("a,b\n1,2");
		});

		it("returns bytes, file name and content type when the file response type is asked for", async () => {
			const bytes = new Uint8Array([0, 255, 128, 1]);
			const http = makeClient(
				() =>
					new Response(bytes, {
						headers: {
							"content-type": "application/json",
							"content-disposition": 'attachment; filename="about.json"',
						},
					}),
			);

			const file = await http.request<{
				bytes: Uint8Array;
				fileName: string | null;
				contentType: string;
			}>("/export", { responseType: "file" });

			expect(Array.from(file.bytes)).toEqual([0, 255, 128, 1]);
			expect(file.fileName).toBe("about.json");
			expect(file.contentType).toBe("application/json");
		});

		it("still turns an error response into a NextpressError in file mode", async () => {
			const http = makeClient(() =>
				Response.json({ message: "No such page", code: "NOT_FOUND" }, { status: 404 }),
			);

			const error = await http
				.request("/export", { responseType: "file" })
				.catch((caught: Error) => caught);

			expect(error).toBeInstanceOf(NextpressError);
			expect(error).toMatchObject({ status: 404, message: "No such page", code: "NOT_FOUND" });
		});

		it("keeps raw responses raw", async () => {
			const http = makeClient(() => new Response("plain", { status: 200 }));

			const response = await http.request<Response>("/api/anything", { raw: true });

			expect(response).toBeInstanceOf(Response);
			expect(await response.text()).toBe("plain");
		});

		it("returns nothing for 204 even in file mode", async () => {
			const http = makeClient(() => new Response(null, { status: 204 }));

			expect(await http.request("/export", { responseType: "file" })).toBeUndefined();
		});
	});
});
