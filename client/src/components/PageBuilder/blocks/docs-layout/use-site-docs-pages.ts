import { useQuery } from "@tanstack/react-query";
import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import { appendSiteIdToUrl } from "@/lib/site-api";
import { useOptionalActiveSite } from "@/hooks/useActiveSite";

const PER_PAGE = 100;
/** A stop for a runaway loop: 100 pages per request, so this is far more pages than a site has. */
const MAX_REQUESTS = 50;

type PagesResponse = { pages?: DocsPage[]; total_pages?: number };

const fetchPagesRequest = async ({ siteId, page }: { siteId: string; page: number }): Promise<PagesResponse> => {
	const url = appendSiteIdToUrl(`/api/pages?status=any&per_page=${PER_PAGE}&page=${page}`, siteId);
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) throw new Error(`Failed to load pages (${response.status}) for site ${siteId}`);
	return response.json();
};

/** Every page of the site, a request at a time (the list is capped per request). */
export const fetchAllSitePages = async (siteId: string): Promise<DocsPage[]> => {
	const pages: DocsPage[] = [];
	for (let page = 1; page <= MAX_REQUESTS; page += 1) {
		const body = await fetchPagesRequest({ siteId, page });
		pages.push(...(body.pages ?? []));
		if (page >= (body.total_pages ?? 1)) break;
	}
	return pages;
};

/**
 * The site's pages for the editor's sidebar preview and the Root page picker. Drafts are included
 * so the preview matches what the editor is building; the published sidebar leaves them out.
 */
export function useSiteDocsPages(): { pages: DocsPage[]; isLoading: boolean } {
	const siteId = useOptionalActiveSite()?.activeSiteId ?? "";
	const { data, isLoading } = useQuery({
		queryKey: ["docs-layout-pages", siteId],
		queryFn: () => fetchAllSitePages(siteId),
		enabled: Boolean(siteId),
		staleTime: 30_000,
	});
	return { pages: data ?? [], isLoading: Boolean(siteId) && isLoading };
}
