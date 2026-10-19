import { randomUUID } from "node:crypto";
import {
	VERSION_STALE,
	type BlockConfig,
	type NextpressClient,
	type PageToolContext,
	type SdkResult,
	type WriteTreeResult,
} from "@nextpress-org/sdk";
import { logError } from "../log-error.js";

export type ContentType = "page" | "post";

/** What the agent reads when someone else saved the page between its read and its write. */
export const STALE_MESSAGE = "The page changed somewhere else. Read the outline again.";

const NOT_A_PAGE_TOOL = "This tool does not use a page.";

/** The saved page or post as last read, with the version the next save must name. */
type LoadedEntity = { id: string; version: number; blocks: BlockConfig[] };

type EntityParams = { client: NextpressClient; contentType: ContentType };

const loadEntity = async ({
	client,
	contentType,
	id,
}: EntityParams & { id: string }): Promise<LoadedEntity> => {
	const entity =
		contentType === "post" ? await client.posts.get({ id }) : await client.pages.get({ id });
	return { id: entity.id, version: entity.version ?? 0, blocks: entity.blocks ?? [] };
};

const saveBlocks = ({
	client,
	contentType,
	entity,
	blocks,
}: EntityParams & { entity: LoadedEntity; blocks: BlockConfig[] }): Promise<
	SdkResult<{ version?: number }>
> =>
	contentType === "post"
		? client.posts.update({ id: entity.id, expectedVersion: entity.version, blocks })
		: client.pages.update({ id: entity.id, expectedVersion: entity.version, blocks });

/**
 * Connects the shared page tools to one saved page or post. Made fresh for every tool call,
 * so a call never works from an older copy than the one it just read.
 *
 * `readTree` loads the entity and keeps its version; `writeTree` saves with that version as
 * `expectedVersion`. If the owner saved in the dashboard in between, the server answers
 * VERSION_STALE and the agent is told to read again, so the agent never overwrites their work.
 *
 * `newId` is a real UUID: the SDK's own block id can fall back to a non-UUID, and form answers
 * find their form by a UUID block id.
 */
export function createEntityContext({
	client,
	contentType,
	id,
	toolName,
}: EntityParams & {
	/** Page UUID or slug (posts: UUID), exactly as the agent sent it. */
	id: string;
	/** The MCP tool being run, so a log line says which call failed. */
	toolName: string;
}): PageToolContext {
	let loaded: LoadedEntity | undefined;
	const logData = { toolName, contentType, id };

	const writeTree = async ({ blocks }: { blocks: BlockConfig[] }): Promise<WriteTreeResult> => {
		if (!loaded) return { ok: false, message: "Read the page before changing it." };
		const entity = loaded;
		const result = await saveBlocks({ client, contentType, entity, blocks });
		if (result.isOk) {
			entity.version = result.value.version ?? entity.version + 1;
			return { ok: true };
		}
		if (result.error.code === VERSION_STALE) return { ok: false, message: STALE_MESSAGE };
		logError({
			atFunction: "createEntityContext.writeTree",
			message: "The server did not accept a page change",
			data: { ...logData, entityId: entity.id, expectedVersion: entity.version },
			error: result.error,
		});
		return {
			ok: false,
			message: `The server did not accept the change: ${result.error.message}. Read the outline again, then try again.`,
		};
	};

	return {
		readTree: async () => {
			loaded = await loadEntity({ client, contentType, id });
			return loaded.blocks;
		},
		writeTree,
		newId: () => randomUUID(),
		onError: ({ tool, error }) =>
			logError({
				atFunction: "createEntityContext.onError",
				message: `A page tool step failed: ${tool}`,
				data: logData,
				error,
			}),
	};
}

/**
 * A context for the tools that never touch a page (block types, design guide). The tools are
 * built from a context, so they get one whose page calls say plainly that no page is in play.
 */
export function createNoPageContext(): PageToolContext {
	return {
		readTree: async () => {
			throw new Error(NOT_A_PAGE_TOOL);
		},
		writeTree: async () => ({ ok: false, message: NOT_A_PAGE_TOOL }),
		newId: () => randomUUID(),
	};
}
