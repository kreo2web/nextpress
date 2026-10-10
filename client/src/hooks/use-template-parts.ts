import { useQuery } from "@tanstack/react-query";
import type { Template } from "@shared/schema-types";

/** A template as the list returns it: the row plus how many pages of the site show it. */
export type LinkedTemplate = Template & { usedOnPages?: number };

export type LinkedTemplateList = {
	templates: LinkedTemplate[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
};

export type TemplateUsagePage = { id: string; title: string; status: string | null };

export type TemplateUsage = { pages: TemplateUsagePage[] };

/**
 * The HTTP status a failed read carried. The shared query function puts it on the error, so a
 * missing template (404) can be told apart from a network or server failure.
 */
export const readRequestStatus = (error: Error | null): number | null => {
	const status = (error as (Error & { status?: number }) | null)?.status;
	return typeof status === "number" ? status : null;
};

/**
 * Linked parts of one site. The site sits in the query key, so switching sites never shows another
 * site's list. Staleness is zero and the list refreshes on focus: a template edited in another tab
 * shows up here without a reload.
 */
export function useLinkedTemplates({
	siteId,
	enabled = true,
}: {
	siteId: string | null;
	enabled?: boolean;
}) {
	return useQuery<LinkedTemplateList>({
		queryKey: ["/api/templates", { usage: "part", siteId, per_page: 100 }],
		enabled: enabled && Boolean(siteId),
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}

/** One linked template or pre-designed block, by id. Same freshness rules as the list. */
export function usePartTemplate({
	templateId,
	enabled = true,
}: {
	templateId: string;
	enabled?: boolean;
}) {
	return useQuery<Template>({
		queryKey: [`/api/templates/${templateId}`],
		enabled: enabled && Boolean(templateId),
		staleTime: 0,
		refetchOnWindowFocus: true,
		retry: false,
	});
}

/** The pages that show a linked part, read when the admin asks to delete it. */
export function useTemplateUsage({
	templateId,
	enabled = true,
}: {
	templateId: string;
	enabled?: boolean;
}) {
	return useQuery<TemplateUsage>({
		queryKey: [`/api/templates/${templateId}/usage`],
		enabled: enabled && Boolean(templateId),
		staleTime: 0,
		retry: false,
	});
}
