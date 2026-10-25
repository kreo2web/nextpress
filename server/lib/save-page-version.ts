import { checkExpectedVersion } from "@shared/content-version";
import type { Deps } from "../routes/shared/deps";
import { scheduleSearchIndexRebuild } from "./site-search";

type PageRow = NonNullable<Awaited<ReturnType<Deps["models"]["pages"]["findById"]>>>;

/** A save that lost the race: someone saved this page after the caller last read it. */
export type PageVersionStale = Error & { pageVersionStale: true; remoteVersion: number; expectedVersion: number };

const pageVersionStale = ({ remoteVersion, expectedVersion }: { remoteVersion: number; expectedVersion: number }): PageVersionStale =>
	Object.assign(new Error(`Remote version ${remoteVersion} does not match expected ${expectedVersion}. Fetch latest and retry.`), {
		pageVersionStale: true as const,
		remoteVersion,
		expectedVersion,
	});

export const isPageVersionStale = (error: Error): error is PageVersionStale =>
	(error as Partial<PageVersionStale>).pageVersionStale === true;

/**
 * Saves changes to a page the one way every page save goes: the version must match the caller's,
 * the version goes up by one, the blocks before the change go into the page's history, and the
 * save and publish hooks and the search rebuild run. The editor's save, the docs routes and page
 * tools all come through here, so restoring an earlier version works the same for each of them.
 * Validation, access and slug checks stay with the caller.
 */
export async function savePageVersion({
	models,
	hooks,
	page,
	changes,
	expectedVersion,
}: {
	models: Deps["models"];
	hooks: Deps["hooks"];
	page: PageRow;
	changes: Record<string, unknown>;
	expectedVersion: number;
}): Promise<PageRow> {
	const remoteVersion = page.version ?? 0;
	const versionCheck = checkExpectedVersion({ remoteVersion, expectedVersion });
	if (!versionCheck.ok) {
		throw pageVersionStale({ remoteVersion: versionCheck.remoteVersion, expectedVersion: versionCheck.expectedVersion });
	}

	const previousSnapshot = {
		version: remoteVersion,
		updatedAt: page.updatedAt ? new Date(page.updatedAt).toISOString() : new Date().toISOString(),
		blocks: page.blocks ?? [],
		authorId: page.authorId,
	};
	const history = Array.isArray(page.history) ? page.history : [];

	const wasPublished = page.status === "publish";
	const saved = await models.pages.update(page.id, {
		...changes,
		version: expectedVersion + 1,
		history: [previousSnapshot, ...history],
	});

	hooks.doAction("save_post", saved);
	scheduleSearchIndexRebuild({ models, siteId: String(page.siteId) });
	if (!wasPublished && saved.status === "publish") hooks.doAction("publish_post", saved);
	return saved;
}
