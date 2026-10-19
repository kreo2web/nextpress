import type { Deps } from "./deps";
import { listWorkableSites } from "../../lib/access/workable-sites";
import { readSiteAddress } from "../../utils/site-address";

export type SiteListItem = {
	id: string;
	name: string | null;
	siteUrl: string | null;
	isDefault: boolean;
};

/**
 * Sites the current person works on in the dashboard (editor or above, owned, or every site for a
 * main-site admin). A subscriber role or no role at all gives none.
 */
export const resolveAccessibleSites = async (params: {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles">;
	userId: string;
}): Promise<SiteListItem[]> => {
	const sites = await listWorkableSites(params);
	return sites
		.map((site) => ({
			id: site.id,
			name: site.name ?? null,
			siteUrl: readSiteAddress(site) || null,
			isDefault: site.isDefault ?? false,
		}))
		.sort((a, b) => {
			if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
			const aLabel = a.name ?? a.siteUrl ?? a.id;
			const bLabel = b.name ?? b.siteUrl ?? b.id;
			return aLabel.localeCompare(bLabel);
		});
};
