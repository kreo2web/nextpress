import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { buildTemplatePartBlock } from "@shared/template-parts";
import { TemplatePartFrame } from "@/components/PageBuilder/blocks/template-part/template-part-frame";
import { TemplatePartSettings } from "@/components/PageBuilder/blocks/template-part/template-part-settings";
import {
	TemplatePartActionsProvider,
	type TemplatePartActions,
} from "@/components/PageBuilder/blocks/template-part/template-part-actions";
import { BlockActionsProvider, type BlockActionsContextValue } from "@/components/PageBuilder/BlockActionsContext";
import { TemplatePartLibrary } from "@/components/PageBuilder/TemplatePartLibrary";
import { getQueryFn } from "@/lib/queryClient";

// The active site is switchable per test: null means "no site", as outside the admin shell.
const siteState = vi.hoisted(() => ({ activeSiteId: "site-a" as string | null }));
vi.mock("@/hooks/useActiveSite", () => ({
	useOptionalActiveSite: () => (siteState.activeSiteId ? { activeSiteId: siteState.activeSiteId } : null),
}));

const shell = (id: string, children: BlockConfig[]): BlockConfig => ({
	id,
	name: "core/page-shell",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: {} },
	children: children.map((child) => ({ ...child, parentId: id })),
});

// A template is one layout block (here a Group) inside the editor's page shell.
const headerBlocks = (): BlockConfig[] => [
	shell("tpl-shell", [
		{
			id: "tpl-root",
			name: "core/group",
			type: "container",
			parentId: "tpl-shell",
			content: { kind: "structured", data: {} },
			children: [
				{
					id: "hero-text",
					name: "core/paragraph",
					type: "block",
					parentId: "tpl-root",
					content: { kind: "text", value: "Welcome to our store" },
				},
			],
		},
	]),
];

const linkedTemplate = (overrides: Record<string, unknown> = {}) => ({
	id: "tpl-header",
	name: "Site header",
	type: "part",
	description: null,
	authorId: "user-1",
	blocks: headerBlocks(),
	settings: {},
	other: { usage: "part", siteId: "site-a" },
	createdAt: null,
	updatedAt: new Date("2026-10-01T09:00:00.000Z").toISOString(),
	...overrides,
});

const jsonResponse = (body: unknown, status = 200) =>
	({
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 404 ? "Not Found" : "OK",
		json: async () => body,
		text: async () => JSON.stringify(body),
	}) as unknown as Response;

/** Routes the templates API used by the block: one template by id, and the site's list. */
const mockTemplatesApi = (templates: Record<string, unknown>[]) => {
	global.fetch = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/api/templates?")) {
			return jsonResponse({ templates, total: templates.length, page: 1, per_page: 100, total_pages: 1 });
		}
		const match = url.match(/\/api\/templates\/([^/?]+)$/);
		const found = match ? templates.find((template) => template.id === match[1]) : undefined;
		return found ? jsonResponse(found) : jsonResponse({ message: "Template not found" }, 404);
	}) as typeof fetch;
};

const blockActionsValue = (onDelete: (id: string) => void): BlockActionsContextValue => ({
	selectedBlockId: null,
	editingBlockId: null,
	hoveredBlockId: null,
	onSelect: () => undefined,
	onStartEditing: () => undefined,
	onStopEditing: () => undefined,
	onHoverBlock: () => undefined,
	onDuplicate: () => undefined,
	onDelete,
	hoverHighlight: null,
});

function renderWithEditor({
	children,
	actions,
	onDelete = () => undefined,
}: {
	children: ReactNode;
	actions: TemplatePartActions;
	onDelete?: (id: string) => void;
}) {
	// Same default fetcher as the app's query client, so keys like ["/api/templates", {...}] build real URLs.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { queryFn: getQueryFn({ on401: "throw" }), retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<TemplatePartActionsProvider value={actions}>
				<BlockActionsProvider value={blockActionsValue(onDelete)}>{children}</BlockActionsProvider>
			</TemplatePartActionsProvider>
		</QueryClientProvider>,
	);
}

describe("template part on the editor canvas", () => {
	let actions: TemplatePartActions;

	beforeEach(() => {
		siteState.activeSiteId = "site-a";
		actions = { insertTemplatePart: vi.fn(), replaceBlockWith: vi.fn() };
	});

	it("shows the template's name and read-only blocks, with Edit template and Detach", async () => {
		mockTemplatesApi([linkedTemplate()]);
		renderWithEditor({
			actions,
			children: <TemplatePartFrame blockId="part-1" parentId="page-shell" templateId="tpl-header" isPreview={false} />,
		});

		const frame = await screen.findByTestId("template-part");
		expect(within(frame).getByText("Site header")).toBeInTheDocument();
		expect(within(frame).getByText("Welcome to our store")).toBeInTheDocument();
		expect(within(frame).getByRole("link", { name: "Edit template" })).toHaveAttribute(
			"href",
			"/admin/page-builder/template/tpl-header",
		);
		expect(within(frame).getByRole("button", { name: "Detach" })).toBeInTheDocument();
	});

	it("asks before detaching, then swaps the part for copies of the template's blocks", async () => {
		const user = userEvent.setup();
		mockTemplatesApi([linkedTemplate()]);
		renderWithEditor({
			actions,
			children: <TemplatePartFrame blockId="part-1" parentId="page-shell" templateId="tpl-header" isPreview={false} />,
		});

		const frame = await screen.findByTestId("template-part");
		await user.click(within(frame).getByRole("button", { name: "Detach" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Detach this template?")).toBeInTheDocument();
		expect(actions.replaceBlockWith).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole("button", { name: "Detach" }));

		expect(actions.replaceBlockWith).toHaveBeenCalledTimes(1);
		const [blockId, copies] = vi.mocked(actions.replaceBlockWith).mock.calls[0];
		expect(blockId).toBe("part-1");
		// The page gets a copy of the template's one layout block, with everything inside it.
		expect(copies.map((block) => block.name)).toEqual(["core/group"]);
		expect(copies[0].parentId).toBe("page-shell");
		expect(copies[0].id).not.toBe("tpl-root");
		const inner = copies[0].children ?? [];
		expect(inner.map((block) => block.name)).toEqual(["core/paragraph"]);
		expect(inner[0].id).not.toBe("hero-text");
		expect(inner[0].content).toEqual({ kind: "text", value: "Welcome to our store" });
	});

	it("says a deleted template was deleted, and removes the block on request", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		mockTemplatesApi([]);
		renderWithEditor({
			actions,
			onDelete,
			children: <TemplatePartFrame blockId="part-1" parentId="page-shell" templateId="tpl-gone" isPreview={false} />,
		});

		expect(await screen.findByText(/This template was deleted/)).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Remove block" }));
		expect(onDelete).toHaveBeenCalledWith("part-1");
	});

	it("does not repeat a template inside itself", async () => {
		const selfReferencing = linkedTemplate({
			blocks: [
				shell("tpl-shell", [
					{
						id: "hero-text",
						name: "core/paragraph",
						type: "block",
						parentId: "tpl-shell",
						content: { kind: "text", value: "Top level text" },
					},
					{ ...buildTemplatePartBlock({ id: "inner", templateId: "tpl-header" }), parentId: "tpl-shell" },
				]),
			],
		});
		mockTemplatesApi([selfReferencing]);
		renderWithEditor({
			actions,
			children: <TemplatePartFrame blockId="part-1" parentId="page-shell" templateId="tpl-header" isPreview={false} />,
		});

		expect(await screen.findByText("Top level text")).toBeInTheDocument();
		expect(screen.getByText(/already shown above/)).toBeInTheDocument();
	});

	it("does not show a template that belongs to another site", async () => {
		siteState.activeSiteId = "site-b";
		mockTemplatesApi([linkedTemplate()]);
		renderWithEditor({
			actions,
			children: <TemplatePartFrame blockId="part-1" parentId="page-shell" templateId="tpl-header" isPreview={false} />,
		});

		expect(await screen.findByText(/belongs to another site/)).toBeInTheDocument();
		expect(screen.queryByText("Welcome to our store")).not.toBeInTheDocument();
	});
});

describe("template part settings and library", () => {
	let actions: TemplatePartActions;

	beforeEach(() => {
		siteState.activeSiteId = "site-a";
		actions = { insertTemplatePart: vi.fn(), replaceBlockWith: vi.fn() };
	});

	it("retries the template list when loading it fails", async () => {
		const user = userEvent.setup();
		let listCalls = 0;
		global.fetch = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/templates?")) {
				listCalls += 1;
				if (listCalls === 1) {
					return jsonResponse({ message: "Could not load templates" }, 500);
				}
				return jsonResponse({
					templates: [linkedTemplate()],
					total: 1,
					page: 1,
					per_page: 100,
					total_pages: 1,
				});
			}
			return jsonResponse({ message: "Template not found" }, 404);
		}) as typeof fetch;

		const block = { ...buildTemplatePartBlock({ id: "part-1", templateId: "" }), parentId: "page-shell" };
		renderWithEditor({
			actions,
			children: <TemplatePartSettings block={block} onUpdate={vi.fn()} />,
		});

		expect(await screen.findByText("The list of templates could not be loaded.")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Try again" }));

		await waitFor(() => {
			expect(screen.queryByText("The list of templates could not be loaded.")).not.toBeInTheDocument();
		});
		expect(listCalls).toBe(2);
	});

	it("offers Edit template and Detach for the chosen template", async () => {
		mockTemplatesApi([linkedTemplate()]);
		const block = { ...buildTemplatePartBlock({ id: "part-1", templateId: "tpl-header" }), parentId: "page-shell" };
		renderWithEditor({
			actions,
			children: <TemplatePartSettings block={block} onUpdate={vi.fn()} />,
		});

		expect(await screen.findByRole("link", { name: "Edit template" })).toHaveAttribute(
			"href",
			"/admin/page-builder/template/tpl-header",
		);
		expect(screen.getByRole("button", { name: "Detach" })).toBeInTheDocument();
		expect(screen.getByText(/Changes to this template show on every page that uses it/)).toBeInTheDocument();
	});

	it("lists this site's templates in the Templates group and inserts the one chosen", async () => {
		const user = userEvent.setup();
		mockTemplatesApi([linkedTemplate()]);
		renderWithEditor({ actions, children: <TemplatePartLibrary /> });

		await user.click(screen.getByRole("button", { name: /Templates/ }));
		const item = await screen.findByRole("button", { name: /Site header/ });
		await user.click(item);

		expect(actions.insertTemplatePart).toHaveBeenCalledWith("tpl-header");
	});
});
