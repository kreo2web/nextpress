/**
 * Who may do what on one site. The one list: the server enforces it and the dashboard reads it
 * to hide what a person can't do. The `roles.capabilities` column in the database is a label for
 * people, never checked, so nobody gains powers by editing a role row.
 */

/** Roles a person can hold on a site, weakest first. Their names match the `roles.name` rows. */
export const SITE_ROLES = ["subscriber", "editor", "admin"] as const;
export type SiteRoleName = (typeof SITE_ROLES)[number];

/** What a person is on one site: a role, or the site's owner (who can do everything an admin can). */
export type SiteStanding = SiteRoleName | "owner";

export const SITE_ACTIONS = [
	/** Pages, posts, blogs, media, blocks, linked parts, forms and their answers, imports, previews. */
	"edit_content",
	/** Approve, mark as spam, change or delete comments. */
	"moderate_comments",
	/** The page assistant, which spends the site's AI key. */
	"use_assistant",
	/** The site's settings, address, theme, options, API keys and AI settings. */
	"manage_site",
	/** Who has which role on the site, and invite links. */
	"manage_people",
] as const;
export type SiteAction = (typeof SITE_ACTIONS)[number];

const EDITOR_ACTIONS: readonly SiteAction[] = ["edit_content", "moderate_comments", "use_assistant"];
const ADMIN_ACTIONS: readonly SiteAction[] = [...EDITOR_ACTIONS, "manage_site", "manage_people"];

const ACTIONS_BY_STANDING: Record<SiteStanding, readonly SiteAction[]> = {
	subscriber: [],
	editor: EDITOR_ACTIONS,
	admin: ADMIN_ACTIONS,
	owner: ADMIN_ACTIONS,
};

const STANDING_RANK: Record<SiteStanding, number> = { subscriber: 1, editor: 2, admin: 3, owner: 4 };

export const SITE_ROLE_LABELS: Record<SiteStanding, string> = {
	subscriber: "Subscriber",
	editor: "Editor",
	admin: "Admin",
	owner: "Owner",
};

/** Plain words for the People screen and invite links. */
export const SITE_ROLE_DESCRIPTIONS: Record<SiteRoleName, string> = {
	subscriber: "Can comment and keep a profile. No dashboard.",
	editor: "Writes and edits pages, posts and media, and answers comments.",
	admin: "Everything an editor does, plus the site's settings, theme, keys and people.",
};

export const isSiteRoleName = (value: string): value is SiteRoleName => (SITE_ROLES as readonly string[]).includes(value);

/** The actions a standing allows; none for no standing. */
export const actionsForStanding = (standing: SiteStanding | null): readonly SiteAction[] =>
	standing ? ACTIONS_BY_STANDING[standing] : [];

export const standingAllows = ({ standing, action }: { standing: SiteStanding | null; action: SiteAction }): boolean =>
	actionsForStanding(standing).includes(action);

/** True when `a` is at least as strong as `b`. No standing is weaker than everything. */
export const isAtLeast = ({ a, b }: { a: SiteStanding | null; b: SiteStanding }): boolean =>
	a !== null && STANDING_RANK[a] >= STANDING_RANK[b];

/** The stronger of several standings, or null when there are none. */
export const strongestStanding = (standings: readonly SiteStanding[]): SiteStanding | null =>
	standings.reduce<SiteStanding | null>(
		(best, next) => (best === null || STANDING_RANK[next] > STANDING_RANK[best] ? next : best),
		null,
	);

/** Editors and above use the dashboard for a site; subscribers don't. */
export const canWorkOnSite = (standing: SiteStanding | null): boolean => isAtLeast({ a: standing, b: "editor" });

/** What the dashboard learns about the signed-in person on one site. */
export type SiteAccess = {
	siteId: string;
	standing: SiteStanding | null;
	actions: SiteAction[];
	/** Owner or admin of the main site: all users, plugins, sites and updates, on every site. */
	isMainSiteAdmin: boolean;
};
