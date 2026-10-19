import { createNextpress } from "../create-nextpress.js";
import { createMockFetch, type MockRoute, mockIds } from "./mock-fetch.js";

export const TEST_SITE_ID = mockIds.siteId;
export const OTHER_SITE_ID = "00000000-0000-4000-8000-000000000077";

/** A client wired to in-memory routes, plus every request it made (in order). */
export function createTestClient(routes: MockRoute[]) {
	const { fetchMock, calls } = createMockFetch(routes);
	const client = createNextpress({
		baseUrl: "https://cms.example.com",
		apiKey: "np_test_key",
		siteId: TEST_SITE_ID,
		fetch: fetchMock,
	});
	return { client, calls, fetchMock };
}

/** Splits a recorded request URL into the parts tests assert on. */
export function readCall(call: { url: string } | undefined) {
	if (!call) throw new Error("Expected a request to have been made, but there was none.");
	const url = new URL(call.url);
	return { pathname: url.pathname, query: Object.fromEntries(url.searchParams.entries()) };
}
