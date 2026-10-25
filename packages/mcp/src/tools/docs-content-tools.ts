import { MAX_DOCS_MDX_LENGTH, type DocsPageMdx } from "@nextpress-org/sdk";
import { z } from "zod";
import { docsText, explainPageWriteError, runDocsTool, valueOrThrow } from "../docs/docs-reply.js";
import type { ToolDeps } from "./tool-deps.js";

const pageIdSchema = z.string().uuid().describe("The page's id, from get_docs_tree");

/** The page as plain lines, with the MDX last so it is easy to copy whole. */
const readReply = (page: DocsPageMdx): string =>
	[
		`Title: ${page.title}`,
		`Description: ${page.description || "none yet (give one with write_docs_page)"}`,
		`Status: ${page.status}`,
		`Version: ${page.version} (send this as expectedVersion when you write the page)`,
		page.skipped.length > 0
			? `Blocks with no MDX form, which writing the page drops: ${page.skipped.join(", ")}`
			: "Blocks with no MDX form: none",
		"",
		"MDX:",
		page.mdx,
	].join("\n");

/** Reading and writing a docs page's text. Writes are checked as they are saved, and nothing is saved on a refusal. */
export function registerDocsContentTools({ server, client }: ToolDeps): void {
	server.registerTool(
		"read_docs_page",
		{
			title: "Read docs page",
			description:
				"Reads one docs page as MDX text, with its title, description, status and version. Send the version back as expectedVersion when you write the page. It also names any blocks that have no MDX form: writing the page drops them, so copy their content into the text first. Read the page again before every write.",
			inputSchema: { pageId: pageIdSchema },
			annotations: { readOnlyHint: true },
		},
		async ({ pageId }) =>
			runDocsTool({
				toolName: "read_docs_page",
				ids: { pageId },
				run: async () => docsText(readReply(await client.docs.readPage({ pageId }))),
			}),
	);

	server.registerTool(
		"write_docs_page",
		{
			title: "Write docs page",
			description:
				"Saves a docs page's MDX text as a new version. Read the page first with read_docs_page and send its version as expectedVersion. The text is checked as it is saved: if it has a mistake, nothing is saved and the reply names the line to fix. If the page changed somewhere else since you read it, nothing is saved and the reply tells you to read it again. Send the whole page each time. Blocks that read_docs_page names as having no MDX form are dropped by this save. Saving does not publish: the page stays a draft.",
			inputSchema: {
				pageId: pageIdSchema,
				mdx: z.string().max(MAX_DOCS_MDX_LENGTH).describe("The whole page, in MDX (see get_docs_guide)"),
				expectedVersion: z.number().int().min(0).describe("The version from read_docs_page"),
				title: z.string().min(1).max(200).optional().describe("A new title"),
				description: z
					.string()
					.max(1000)
					.optional()
					.describe("A new description: one or two plain sentences. It shows under the title and in search."),
			},
		},
		async ({ pageId, mdx, expectedVersion, title, description }) =>
			runDocsTool({
				toolName: "write_docs_page",
				ids: { pageId },
				explain: explainPageWriteError,
				run: async () => {
					const saved = valueOrThrow(
						await client.docs.writePage({ pageId, mdx, expectedVersion, title, description }),
					);
					return docsText(
						`Saved as version ${saved.version}. The page is still a draft. Publish it with publish_page, using version ${saved.version}, only when the owner asks.`,
					);
				},
			}),
	);
}
