import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Templates from "@/pages/Templates";
import { getQueryFn } from "@/lib/queryClient";

const siteState = vi.hoisted(() => ({ activeSiteId: "site-a" as string }));

vi.mock("@/hooks/useActiveSite", () => ({
	useActiveSite: () => ({ activeSiteId: siteState.activeSiteId, isLoading: false }),
}));

vi.mock("@/components/AdminLayout", () => ({
	AdminLayout: ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
		<div>
			<h1>{title}</h1>
			{actions}
			{children}
		</div>
	),
}));

const template = (overrides: Record<string, unknown>) => ({
	authorId: "user-1",
	blocks: [],
	settings: {},
	description: null,
	createdAt: null,
	updatedAt: null,
	other: { usage: "part", siteId: "site-a" },
	...overrides,
});

const root = (name: string) => ({ id: `root-${name}`, name, type: "container", parentId: null, content: { kind: "structured", data: {} }, children: [] });

const jsonResponse = (body: unknown) =>
	({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

const renderPage = () => {
	// Same default fetcher as the app's query client, so keys like ["/api/templates", {...}] build real URLs.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { queryFn: getQueryFn({ on401: "throw" }), retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<Templates />
		</QueryClientProvider>,
	);
};

describe("Templates page", () => {
	beforeEach(() => {
		siteState.activeSiteId = "site-a";
	});

	it("lists this site's linked templates with how many pages use each", async () => {
		const requested: string[] = [];
		global.fetch = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return jsonResponse({
				templates: [
					template({ id: "tpl-header", name: "Main header", type: "part", usedOnPages: 3, blocks: [root("core/header")] }),
					template({ id: "tpl-signup", name: "Sign-up box", type: "part", usedOnPages: 0, blocks: [root("core/group")] }),
				],
				total: 2,
				page: 1,
				per_page: 100,
				total_pages: 1,
			});
		}) as typeof fetch;

		renderPage();

		await screen.findByText("Main header");
		const rowWith = (...texts: string[]) =>
			screen.getAllByRole("row").find((row) => texts.every((text) => row.textContent?.includes(text)));

		// Each template is named by its one layout block, whatever it holds.
		expect(rowWith("Main header", "Used on 3 pages", "Header")).toBeDefined();
		expect(rowWith("Sign-up box", "Not used yet", "Group")).toBeDefined();

		expect(requested.some((url) => url.includes("usage=part") && url.includes("siteId=site-a"))).toBe(true);
	});

	it("says what the page is for when empty, with one action", async () => {
		global.fetch = vi.fn(async () =>
			jsonResponse({ templates: [], total: 0, page: 1, per_page: 100, total_pages: 0 }),
		) as typeof fetch;

		renderPage();

		expect(await screen.findByText("Build a block once (a header, a footer, a sign-up box, anything) and use it on every page.")).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: /New template/ }).length).toBeGreaterThanOrEqual(1);
	});
});
