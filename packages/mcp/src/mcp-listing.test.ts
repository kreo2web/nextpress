import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PAGE_DESIGN_GUIDE } from "@nextpress-org/sdk";
import { MCP_SERVER_VERSION } from "./create-mcp-server.js";
import { createFakeApi } from "./test/fake-nextpress-api.js";
import { connectMcpSession, createSdkOverFakeApi, resourceText, type LinkedSession } from "./test/mcp-session.js";

type JsonNode = string | number | boolean | null | JsonNode[] | { [key: string]: JsonNode };

type ListedTool = {
	name: string;
	description?: string;
	inputSchema: { properties?: Record<string, JsonNode>; required?: string[] };
	annotations?: { readOnlyHint?: boolean };
};

/** Every `$ref` in a JSON Schema, with the path of the object that holds it. */
const collectRefs = (node: JsonNode, path: string[] = []): Array<{ ref: string; path: string[] }> => {
	if (Array.isArray(node)) return node.flatMap((item, index) => collectRefs(item, [...path, String(index)]));
	if (node === null || typeof node !== "object") return [];
	return Object.entries(node).flatMap(([key, value]) =>
		key === "$ref" && typeof value === "string" ? [{ ref: value, path }] : collectRefs(value, [...path, key]),
	);
};

const PAGE_TOOLS = ["get_page_outline", "get_page_block", "change_page_blocks", "check_page", "apply_page_phone_fixes"];
const SITE_LEVEL_TOOLS = ["list_block_types", "get_block_type", "get_design_guide"];

describe("what the MCP server offers", () => {
	let session: LinkedSession | undefined;
	let tools: ListedTool[];

	beforeEach(async () => {
		session = await connectMcpSession(createSdkOverFakeApi(createFakeApi()));
		tools = (await session.client.listTools()).tools as ListedTool[];
	});

	afterEach(async () => {
		await session?.close();
		session = undefined;
	});

	const toolNamed = (name: string): ListedTool => {
		const tool = tools.find((candidate) => candidate.name === name);
		if (!tool) throw new Error(`test setup: no tool named ${name}`);
		return tool;
	};

	describe("tools", () => {
		it("lists every new tool", () => {
			const names = tools.map((tool) => tool.name);
			expect(names).toEqual(
				expect.arrayContaining([
					...PAGE_TOOLS,
					...SITE_LEVEL_TOOLS,
					"get_page_history",
					"restore_page_version",
					"list_template_parts",
					"create_template_part",
					"get_template_part_usage",
					"list_form_submissions",
					"copy_brand_logo",
				]),
			);
			expect(new Set(names).size).toBe(names.length);
		});

		it("keeps the tools older agents already use", () => {
			const names = tools.map((tool) => tool.name);
			expect(names).toEqual(
				expect.arrayContaining(["build_blocks", "validate_blocks", "patch_page_blocks", "patch_post_blocks"]),
			);
		});

		it("asks every page tool for the page, with content_type optional and defaulting to page", () => {
			for (const name of PAGE_TOOLS) {
				const { inputSchema } = toolNamed(name);
				expect(inputSchema.required, name).toContain("id");
				expect(inputSchema.required ?? [], name).not.toContain("content_type");
				expect(inputSchema.properties?.content_type, name).toMatchObject({ enum: ["page", "post"], default: "page" });
			}
		});

		it("asks get_page_block for the block under block_id, so the page keeps id", () => {
			const { inputSchema } = toolNamed("get_page_block");
			expect(inputSchema.required).toEqual(expect.arrayContaining(["id", "block_id"]));
			expect(toolNamed("get_page_block").description).toContain("block_id");
		});

		it("asks the site-level tools for no page", () => {
			for (const name of SITE_LEVEL_TOOLS) {
				expect(toolNamed(name).inputSchema.properties?.id, name).toBeUndefined();
				expect(toolNamed(name).inputSchema.properties?.content_type, name).toBeUndefined();
			}
			expect(toolNamed("get_block_type").inputSchema.required).toEqual(["name"]);
		});

		it("marks read tools read-only and the tools that change a page not", () => {
			for (const name of ["get_page_outline", "get_page_block", "check_page", ...SITE_LEVEL_TOOLS]) {
				expect(toolNamed(name).annotations?.readOnlyHint, name).toBe(true);
			}
			for (const name of ["change_page_blocks", "apply_page_phone_fixes"]) {
				expect(toolNamed(name).annotations?.readOnlyHint, name).toBe(false);
			}
		});

		it("describes every tool with the names the agent can call", () => {
			for (const name of [...PAGE_TOOLS, ...SITE_LEVEL_TOOLS]) {
				const description = toolNamed(name).description ?? "";
				expect(description, name).not.toMatch(/\b(get_block|change_blocks|apply_phone_fixes)\b/);
			}
			expect(toolNamed("change_page_blocks").description).toContain("get_page_outline");
			expect(toolNamed("check_page").description).toContain("apply_page_phone_fixes");
		});

		it("points the older patch and build tools at change_page_blocks", () => {
			for (const name of ["patch_page_blocks", "patch_post_blocks", "build_blocks", "update_page"]) {
				expect(toolNamed(name).description, name).toContain("change_page_blocks");
			}
		});

		it("gives the tools that read or search a plain, model-facing description", () => {
			for (const name of [
				"get_page_history",
				"restore_page_version",
				"list_template_parts",
				"create_template_part",
				"get_template_part_usage",
				"list_form_submissions",
				"copy_brand_logo",
			]) {
				expect(toolNamed(name).description?.length ?? 0, name).toBeGreaterThan(100);
			}
		});

		it("sends every page tool's input schema with no $ref anywhere", () => {
			for (const name of [...PAGE_TOOLS, "build_blocks"]) {
				expect(collectRefs(toolNamed(name).inputSchema as JsonNode), `${name} has a $ref in its schema`).toEqual([]);
			}
		});

		it("keeps the change_page_blocks input schema small, since agents read it on every step", () => {
			// 9,977 characters before nested levels stopped repeating the outer level's descriptions.
			expect(JSON.stringify(toolNamed("change_page_blocks").inputSchema).length).toBeLessThan(8_000);
		});
	});

	describe("prompts", () => {
		it("lists build_page and edit_block with their arguments", async () => {
			const { prompts } = await session!.client.listPrompts();
			const byName = Object.fromEntries(prompts.map((prompt) => [prompt.name, prompt]));

			expect(Object.keys(byName).sort()).toEqual(["build_page", "edit_block"]);
			expect(byName.build_page?.arguments?.map((arg) => [arg.name, arg.required])).toEqual([
				["purpose", false],
				["audience", false],
			]);
			expect(byName.edit_block?.arguments?.map((arg) => [arg.name, arg.required])).toEqual([
				["id", true],
				["block_id", true],
				["request", true],
			]);
		});

		it("build_page carries the design guide, the brief and the workflow in order", async () => {
			const prompt = await session!.client.getPrompt({
				name: "build_page",
				arguments: { purpose: "a landing page for a bakery", audience: "local customers on phones" },
			});

			const first = prompt.messages[0];
			expect(first?.role).toBe("user");
			const text = first?.content.type === "text" ? first.content.text : "";
			expect(text).toContain(PAGE_DESIGN_GUIDE);
			expect(text).toContain("What the page is for: a landing page for a bakery");
			expect(text).toContain("Who it is for: local customers on phones");
			const steps = ["get_page_outline", "list_block_types", "change_page_blocks", "check_page", "preview_page", "Leave it as a draft"];
			const positions = steps.map((step) => text.indexOf(step, text.indexOf("# Workflow")));
			expect(positions.every((position) => position > 0)).toBe(true);
			expect([...positions].sort((a, b) => a - b)).toEqual(positions);
			expect(text).not.toMatch(/\b(get_block|change_blocks|apply_phone_fixes)\b/);
		});

		it("build_page works when no argument is filled in", async () => {
			const prompt = await session!.client.getPrompt({ name: "build_page", arguments: {} });

			const text = prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "";
			expect(text).toContain("# Building NextPress pages");
			expect(text).not.toContain("What the page is for:");
		});

		it("edit_block names the page and block, and keeps the agent inside the block", async () => {
			const prompt = await session!.client.getPrompt({
				name: "edit_block",
				arguments: { id: "home", block_id: "hero-1", request: "Make the heading shorter" },
			});

			const text = prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "";
			expect(text).toContain("Page: home");
			expect(text).toContain("Block: hero-1");
			expect(text).toContain("Request: Make the heading shorter");
			expect(text).toContain('get_page_block with id "home" and block_id "hero-1"');
			expect(text).toContain("Touch only block hero-1");
			expect(text).toContain("Do not run apply_page_phone_fixes");
		});
	});

	describe("resources and server details", () => {
		it("serves the design guide as markdown", async () => {
			const resource = await session!.client.readResource({ uri: "nextpress://design-guide" });

			expect(resource.contents[0]?.mimeType).toBe("text/markdown");
			expect(resourceText(resource)).toBe(PAGE_DESIGN_GUIDE);
		});

		it("reports version 0.3.0 and tells the agent where to start", () => {
			expect(MCP_SERVER_VERSION).toBe("0.3.0");
			expect(session!.client.getServerVersion()?.version).toBe("0.3.0");
			const instructions = session!.client.getInstructions() ?? "";
			expect(instructions).toContain("get_page_outline");
			expect(instructions).toContain("build_page");
		});
	});
});
