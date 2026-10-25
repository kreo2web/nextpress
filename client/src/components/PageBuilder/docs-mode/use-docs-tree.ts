import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { DocsTree } from "@shared/docs";
import { fetchDocsTreeOfPage } from "./docs-api";

/** Every docs tree the editor holds starts its key with this, so one call refreshes them all. */
export const DOCS_TREE_KEY = "docs-tree";

/** The tree and settings of the docs the page being edited sits in. Null while it loads or when the page is in no docs. */
export function useDocsTree({ pageId }: { pageId: string }): { tree: DocsTree | null; isLoading: boolean; failed: boolean } {
	const { data, isLoading, isError } = useQuery<DocsTree>({
		queryKey: [DOCS_TREE_KEY, pageId],
		queryFn: () => fetchDocsTreeOfPage({ pageId }),
		enabled: Boolean(pageId),
		staleTime: 5_000,
	});
	return { tree: data ?? null, isLoading: Boolean(pageId) && isLoading, failed: isError };
}

/** Asks every cached docs tree to load again (after a page was added, moved, renamed or deleted). */
export const refreshDocsTrees = ({ queryClient }: { queryClient: QueryClient }): Promise<void> =>
	queryClient.invalidateQueries({ queryKey: [DOCS_TREE_KEY] });

/** The same, as a function to call from an event handler. */
export function useRefreshDocsTrees(): () => Promise<void> {
	const queryClient = useQueryClient();
	return () => refreshDocsTrees({ queryClient });
}
