import { outlinePage, type BlockConfig, type NextpressClient } from "@nextpress-org/sdk";
import { z } from "zod";
import { formatError, formatJson, runTool } from "../format-result.js";
import type { ToolDeps } from "./tool-deps.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const countBlocks = (blocks: BlockConfig[]): number =>
	blocks.reduce((total, block) => total + 1 + countBlocks(block.children ?? []), 0);

/** The history routes only take a UUID, while agents often know a page by its slug. */
const resolvePageId = async ({
	client,
	id,
}: {
	client: NextpressClient;
	id: string;
}): Promise<string> =>
	UUID_PATTERN.test(id) ? id : (await client.pages.get({ id })).id;

/** Earlier versions of a page: list them, then put one back. */
export function registerHistoryTools({ server, client }: ToolDeps): void {
	server.registerTool(
		"get_page_history",
		{
			title: "Page history",
			description:
				"Lists the earlier saved versions of a page, newest first, with the page's current version. Each entry has its version number, when it was saved, who saved it and how many blocks it held (not the blocks themselves). Use it to find a version to go back to after a bad change, then call restore_page_version. Accepts the page's UUID or slug.",
			inputSchema: { id: z.string().min(1).describe("Page UUID or slug") },
			annotations: { readOnlyHint: true },
		},
		async ({ id }) =>
			runTool(async () => {
				const pageId = await resolvePageId({ client, id });
				const { currentVersion, history } = await client.pages.getHistory({ id: pageId });
				return formatJson({
					pageId,
					currentVersion,
					versions: history.map((entry) => ({
						version: entry.version,
						savedAt: entry.updatedAt,
						authorId: entry.authorId,
						message: entry.message,
						blockCount: countBlocks(entry.blocks),
					})),
				});
			}),
	);

	server.registerTool(
		"restore_page_version",
		{
			title: "Restore page version",
			description:
				"Puts an earlier version of a page's blocks back. Send the version to go back to (from get_page_history) and expectedVersion, the page's current version from get_page_history or get_page. If the page has been saved since, nothing is restored and you are told to read it again, so you never undo someone else's newer work. The blocks being replaced are saved in the history first, so a restore can itself be undone. Only the blocks change, not the title, slug or status. Returns the page's new version and an outline of the restored blocks.",
			inputSchema: {
				id: z.string().min(1).describe("Page UUID or slug"),
				version: z.number().int().min(0).describe("The earlier version to put back, from get_page_history"),
				expectedVersion: z
					.number()
					.int()
					.min(0)
					.describe("The page's current version, from get_page_history or get_page"),
			},
		},
		async ({ id, version, expectedVersion }) =>
			runTool(async () => {
				const pageId = await resolvePageId({ client, id });
				// The server's restore route takes no expectedVersion, so the check is made here.
				// A save landing between this check and the restore is possible but narrow, and the
				// replaced blocks are kept in the history, so nothing is lost.
				const { currentVersion } = await client.pages.getHistory({ id: pageId });
				if (currentVersion !== expectedVersion) {
					return formatError(
						new Error(
							`The page changed somewhere else: it is now at version ${currentVersion}, not ${expectedVersion}. Read get_page_history again, then retry with the current version.`,
						),
					);
				}
				const result = await client.pages.restoreVersion({ id: pageId, version });
				if (!result.isOk) return formatError(result.error);
				const page = result.value;
				return formatJson({
					id: page.id,
					title: page.title,
					slug: page.slug,
					status: page.status,
					version: page.version,
					restoredFrom: version,
					outline: outlinePage({ blocks: page.blocks ?? [] }),
				});
			}),
	);
}
