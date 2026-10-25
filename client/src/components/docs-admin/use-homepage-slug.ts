import { useQuery } from "@tanstack/react-query";
import { buildSiteOptionUrl } from "@/lib/site-api";

type HomepageOption = { name: string; value: string };

/**
 * The page a site shows at its root, by address part, or undefined when none is set. It shares its
 * query key with the Pages screen, so asking again costs nothing. Only used to word an address,
 * so a failed read quietly leaves the address as the home page's own path.
 */
export function useHomepageSlug({ siteId }: { siteId: string }): string | undefined {
	const query = useQuery<HomepageOption | null, Error>({
		queryKey: ["/api/options/homepage_page_slug", { siteId }],
		enabled: siteId !== "",
		queryFn: async () => {
			const response = await fetch(buildSiteOptionUrl({ name: "homepage_page_slug", siteId }), { credentials: "include" });
			if (response.status === 404) return null;
			if (!response.ok) throw new Error(`Could not read the homepage setting (${response.status})`);
			return (await response.json()) as HomepageOption;
		},
	});
	return query.data?.value;
}
