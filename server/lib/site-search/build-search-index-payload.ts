import MiniSearch from "minisearch";
import { setImmediate as letOtherWorkRun } from "node:timers/promises";
import { safeTryAsync } from "../../utils";
import { buildSearchDocuments, type SearchablePage } from "./build-search-documents";
import { SEARCH_INDEX_OPTIONS, SEARCH_INDEX_VERSION, type SearchDocument, type SearchIndexPayload } from "./search-index-options";

/** Pages read in one go. After each batch the server answers whatever else is waiting, so a big site never freezes it. */
const PAGES_PER_BATCH = 25;

/** A page left out of the index because reading its text failed. The rest of the site still gets searched. */
export type SkippedPage = { pageId: string; error: Error };

const inBatches = <T>(items: T[], size: number): T[][] =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, batch) => items.slice(batch * size, (batch + 1) * size));

/**
 * Turns a site's readable pages into the saved search index the browser downloads. The index holds
 * every word of every page but only a short excerpt per entry travels back out in results, so the
 * browser can search offline yet cannot read a whole page from the file.
 * One page that cannot be read is skipped and reported, never a reason to lose search for the site.
 */
export const buildSearchIndexPayload = async ({
	pages,
	builtAt,
}: {
	pages: SearchablePage[];
	builtAt: Date;
}): Promise<{ payload: SearchIndexPayload; skipped: SkippedPage[] }> => {
	const mini = new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS);
	const skipped: SkippedPage[] = [];

	const batches = inBatches(pages, PAGES_PER_BATCH);
	for (const [number, batch] of batches.entries()) {
		const read = await Promise.all(
			batch.map(async (page) => ({ page, ...(await safeTryAsync(async () => buildSearchDocuments(page))) })),
		);
		read.forEach(({ page, err, result }) => {
			if (err || !result) {
				skipped.push({ pageId: page.id, error: err ?? new Error("Reading the page's text gave nothing") });
				return;
			}
			mini.addAll(result);
		});
		if (number < batches.length - 1) await letOtherWorkRun();
	}

	return {
		payload: { version: SEARCH_INDEX_VERSION, builtAt: builtAt.toISOString(), options: SEARCH_INDEX_OPTIONS, index: mini.toJSON() },
		skipped,
	};
};
