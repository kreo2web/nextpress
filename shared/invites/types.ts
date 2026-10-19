import type { SiteRoleName } from "../access";

/** Where a link stands. Only `open` links can be used. */
export type InviteState = "open" | "full" | "ended" | "cancelled";

/** One invite link as its site's admins see it on the People screen. */
export type InviteSummary = {
	id: string;
	siteId: string;
	role: SiteRoleName;
	code: string;
	/** The path to share; the dashboard adds the site's address. */
	path: string;
	note: string | null;
	maxUses: number | null;
	uses: number;
	/** Null when there is no limit. */
	placesLeft: number | null;
	expiresAt: string | null;
	state: InviteState;
	createdAt: string | null;
};

/** What someone opening a link sees before they join. Nothing about other people or the site's settings. */
export type InviteView = {
	siteName: string;
	role: SiteRoleName;
	state: InviteState;
	placesLeft: number | null;
	expiresAt: string | null;
};

export type CreateInviteInput = {
	siteId: string;
	role: SiteRoleName;
	/** Null = anyone with the link, no limit. */
	maxUses: number | null;
	/** Null = never ends. */
	expiresInDays: number | null;
	note?: string;
};

export type JoinInput = { name: string; email: string; username: string; password: string };

export type JoinResult = { siteId: string; role: SiteRoleName; createdAccount: boolean };
