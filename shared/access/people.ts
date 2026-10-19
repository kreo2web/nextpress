import type { SiteStanding } from "./site-roles";

/** One person on a site's People screen. */
export type SitePerson = {
	userId: string;
	name: string;
	email: string | null;
	username: string;
	profileImageUrl: string | null;
	standing: SiteStanding;
};
