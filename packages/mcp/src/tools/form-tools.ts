import { z } from "zod";
import { formatJson, runTool } from "../format-result.js";
import type { ToolDeps } from "./tool-deps.js";

/** What visitors sent through the site's Form blocks. Read only. */
export function registerFormTools({ server, client }: ToolDeps): void {
	server.registerTool(
		"list_form_submissions",
		{
			title: "List form answers",
			description:
				'Reads what visitors sent through the site\'s Form blocks, newest first. Each answer has its form name, the page it came from, a status ("new" or "read") and its fields as label and value. The reply also lists every form name (to filter by) and how many answers are unread. Use it when the owner asks about leads, messages or sign-ups. It only reads: nothing is marked read or removed. Answers hold visitors\' personal details, so quote only what the owner asked for.',
			inputSchema: {
				form: z.string().min(1).max(200).optional().describe("Only this form, by name (see formNames in the reply)"),
				status: z.enum(["new", "read"]).optional().describe('"new" for unread answers only'),
				page: z.number().int().min(1).optional(),
				per_page: z.number().int().min(1).max(100).optional(),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => runTool(async () => formatJson(await client.forms.submissions.list(args))),
	);
}
