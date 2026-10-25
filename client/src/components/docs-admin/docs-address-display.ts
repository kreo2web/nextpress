import { buildPublicContentUrl } from "@/lib/site-api";
import type { ActiveSiteItem } from "@/hooks/useActiveSite";

/** What the Docs screen shows for a docs' address, and where it links. */
export type DocsAddressDisplay = { text: string; href: string | null };

type DocsAddressInput = {
	/** The site the docs live on. */
	site: ActiveSiteItem | undefined;
	/** The docs home's address, like `/docs`. */
	path: string;
	/** The site's homepage setting: when it is the docs home, the docs answer at the site's root. */
	homepageSlug: string | undefined;
	status: string;
};

const withoutScheme = (url: string): string => url.replace(/^https?:\/\//, "").replace(/\/+$/, "");

/**
 * The address people type to reach the docs. Docs that are their site's homepage (the "own
 * address" kind) are reached at the site's root; others at the site's address plus the home's
 * path. Only published docs link: a draft has no live page yet.
 */
export function describeDocsAddress({ site, path, homepageSlug, status }: DocsAddressInput): DocsAddressDisplay {
	const slug = path.replace(/^\/+/, "");
	const siteAddress = site?.siteUrl?.trim().replace(/\/+$/, "");
	const atRoot = Boolean(siteAddress) && homepageSlug !== undefined && homepageSlug === slug;
	const url = atRoot ? siteAddress : buildPublicContentUrl({ site, slug, kind: "page", pagePath: slug });
	if (!url) return { text: path, href: null };
	return { text: withoutScheme(url), href: status === "publish" ? url : null };
}
