import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DocsSummary, DocsTree } from "@shared/docs";
import { docsListKey, docsTreeKey, fetchDocsTree, fetchSiteDocs } from "@/lib/docs/docs-api";

/**
 * The docs on a site. Always asks again when a screen opens: docs are made and changed in the
 * editor and by agents too, and a stale "no docs yet" would send someone through setup twice.
 */
export function useSiteDocs({
	siteId,
	enabled = true,
}: {
	siteId: string;
	enabled?: boolean;
}): UseQueryResult<DocsSummary[], Error> {
	return useQuery<DocsSummary[], Error>({
		queryKey: docsListKey(siteId),
		queryFn: () => fetchSiteDocs({ siteId }),
		enabled: enabled && siteId !== "",
		staleTime: 0,
	});
}

/** One docs as a tree of pages and groups. Fresh on every open, for the same reason as the list. */
export function useDocsTree({
	homeId,
	enabled = true,
}: {
	homeId: string;
	enabled?: boolean;
}): UseQueryResult<DocsTree, Error> {
	return useQuery<DocsTree, Error>({
		queryKey: docsTreeKey(homeId),
		queryFn: () => fetchDocsTree({ homeId }),
		enabled: enabled && homeId !== "",
		staleTime: 0,
	});
}
