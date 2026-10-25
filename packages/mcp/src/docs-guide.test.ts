import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNextpress } from "@nextpress-org/sdk";
import { DOCS_GUIDE, DOCS_GUIDE_URI } from "./docs/docs-guide.js";
import { DOCS_MDX_CHEAT_SHEET } from "./docs/docs-mdx-cheat-sheet.js";
import { writeDocsPrompt } from "./prompts/write-docs-prompt.js";
import { SITE_ID } from "./test/fake-nextpress-api.js";
import { connectMcpSession, resourceText, textPayload, type LinkedSession } from "./test/mcp-session.js";

/**
 * The server's allowlist of docs components, read from its source. The cheat sheet must teach
 * exactly these tags and attributes, plus `Update` (the release-note component the server adds).
 */
const ALLOWLIST_PATH = fileURLToPath(new URL("../../../shared/markdown/doc-component-props.ts", import.meta.url));

/** Each tag and the attributes it takes, from the two lists in the allowlist file (not its internal attributes). */
const readAllowlist = (): Record<string, string[]> => {
	const source = readFileSync(ALLOWLIST_PATH, "utf8");
	const start = source.indexOf("export const CONTAINER_DOC_PROPS");
	const end = source.indexOf("export const DOC_COMPONENT_PROPS");
	expect(start, "CONTAINER_DOC_PROPS is in the allowlist file").toBeGreaterThan(-1);
	expect(end, "DOC_COMPONENT_PROPS is in the allowlist file").toBeGreaterThan(start);
	const lists = [...source.slice(start, end).matchAll(/^\s+(\w+): \[([^\]]*)\],?$/gm)];
	return Object.fromEntries(lists.map((match) => [match[1] ?? "", [...(match[2] ?? "").matchAll(/"([^"]+)"/g)].map((prop) => prop[1] ?? "")]));
};

/** The attribute names in one opening tag's attribute text, ignoring the values in quotes and braces. */
const attributeNames = (attributes: string): string[] =>
	[...attributes.replace(/"[^"]*"/g, "").replace(/\{[^}]*\}/g, "").matchAll(/([A-Za-z][\w-]*)(?=\s*=|\s|$)/g)].map(
		(match) => match[1] ?? "",
	);

/** Every tool name the guide and the prompt mention, by its verb-first snake_case shape. */
const namesMentioned = (text: string): string[] =>
	[...text.matchAll(/\b(?:list|get|create|update|add|reorder|delete|read|write|publish|upload)_[a-z_]+\b/g)].map((match) => match[0]);

describe("the docs guide", () => {
	let session: LinkedSession | undefined;

	beforeEach(async () => {
		session = await connectMcpSession(
			createNextpress({ baseUrl: "https://cms.example.com", apiKey: "npk_live_test", siteId: SITE_ID, fetch: vi.fn() as typeof fetch }),
		);
	});

	afterEach(async () => {
		await session?.close();
		session = undefined;
	});

	describe("the cheat sheet against the server's allowlist", () => {
		const cheatTags = (): string[] => [...new Set([...DOCS_MDX_CHEAT_SHEET.matchAll(/<([A-Z][A-Za-z]*)\b/g)].map((match) => match[1] ?? ""))];

		it("teaches exactly the tags in the allowlist, plus Update", () => {
			const allowed = Object.keys(readAllowlist());

			expect(allowed.length).toBeGreaterThan(15);
			expect(new Set(cheatTags())).toEqual(new Set([...allowed, "Update"]));
		});

		it("shows every attribute each tag takes, and no attribute the tag does not take", () => {
			const allowlist = readAllowlist();
			allowlist.Update ??= ["label", "description"];

			for (const tag of Object.keys(allowlist)) {
				const openings = [...DOCS_MDX_CHEAT_SHEET.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, "g"))].map((match) => match[1] ?? "");
				expect(openings.length, `${tag} has an example in the cheat sheet`).toBeGreaterThan(0);
				const shown = new Set(openings.flatMap(attributeNames));
				const taken = allowlist[tag] ?? [];
				for (const name of shown) expect(taken, `${tag} does not take ${name}`).toContain(name);
				for (const name of taken) expect(shown, `the cheat sheet never shows ${tag} ${name}`).toContain(name);
			}
		});

		it("states the rules that keep MDX working", () => {
			expect(DOCS_MDX_CHEAT_SHEET).toContain("Put every block tag on its own line");
			expect(DOCS_MDX_CHEAT_SHEET).toContain("After an opening block tag, leave one blank line. Before its closing tag, leave one blank line.");
		});

		it("shows code fences with a title, line marks and line numbers, and a mermaid diagram", () => {
			expect(DOCS_MDX_CHEAT_SHEET).toMatch(/```ts \{2,4-6\} title="app\.ts" showLineNumbers/);
			expect(DOCS_MDX_CHEAT_SHEET).toMatch(/```mermaid\n/);
			expect(DOCS_MDX_CHEAT_SHEET).toMatch(/\| Setting \| Default \| What it does \|/);
		});
	});

	describe("the writing guide", () => {
		it("covers the components and habits the brief asks for", () => {
			for (const phrase of [
				"Steps",
				"Tabs",
				"CodeGroup",
				"Warning",
				"Mermaid",
				"Cards",
				"A description.",
				"Put the language right after",
				"Six sections at most",
				"Sections with ## headings",
			]) {
				expect(DOCS_GUIDE, phrase).toContain(phrase);
			}
		});

		it("names only tools that exist", async () => {
			const { tools } = await session!.client.listTools();
			const toolNames = new Set(tools.map((tool) => tool.name));
			const mentioned = namesMentioned(`${DOCS_GUIDE}\n${writeDocsPrompt({ topic: "x" })}`);

			expect(mentioned.length).toBeGreaterThan(5);
			for (const name of mentioned) expect(toolNames.has(name), name).toBe(true);
		});
	});

	describe("the same text, whichever way an agent asks", () => {
		it("lists the write_docs prompt with topic required and audience optional", async () => {
			const { prompts } = await session!.client.listPrompts();
			const prompt = prompts.find((candidate) => candidate.name === "write_docs");

			expect(prompt?.arguments?.map((arg) => [arg.name, arg.required])).toEqual([
				["topic", true],
				["audience", false],
			]);
		});

		it("gives the prompt its topic, its audience, the workflow, and the guide itself", async () => {
			const prompt = await session!.client.getPrompt({
				name: "write_docs",
				arguments: { topic: "Installing NextPress", audience: "site owners new to CMSs" },
			});

			const text = prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "";
			expect(text).toContain("Topic: Installing NextPress");
			expect(text).toContain("Who reads them: site owners new to CMSs");
			expect(text).toContain(DOCS_GUIDE);
			const steps = ["list_docs", "get_docs_tree", "add_docs_page", "read_docs_page", "write_docs_page", "publish_page"];
			const positions = steps.map((step) => text.indexOf(step, text.indexOf("# Workflow")));
			expect(positions.every((position) => position > 0)).toBe(true);
			expect([...positions].sort((a, b) => a - b)).toEqual(positions);
			expect(text).toContain("Leave everything as a draft.");
		});

		it("works when the audience is left out", async () => {
			const prompt = await session!.client.getPrompt({ name: "write_docs", arguments: { topic: "Pages" } });

			const text = prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "";
			expect(text).toContain("Topic: Pages");
			expect(text).not.toContain("Who reads them:");
		});

		it("serves the guide as markdown at nextpress://docs/guide, with the same text", async () => {
			const resource = await session!.client.readResource({ uri: DOCS_GUIDE_URI });

			expect(resource.contents[0]?.mimeType).toBe("text/markdown");
			expect(resourceText(resource)).toBe(DOCS_GUIDE);
		});

		it("gives the get_docs_guide tool the same text", async () => {
			const result = await session!.client.callTool({ name: "get_docs_guide", arguments: {} });

			expect(result.isError).toBeFalsy();
			expect(textPayload(result as { content: Array<{ type: string; text?: string }> })).toBe(DOCS_GUIDE);
		});
	});
});
