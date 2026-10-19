import type { InviteState } from "./types";

/** Choices the dashboard offers; the server accepts any whole number of days in this range. */
export const INVITE_LIMITS = {
	maxPlaces: 1000,
	maxDays: 365,
	defaultDays: 7,
	noteLength: 200,
} as const;

export const INVITE_PATH_PREFIX = "/join/";

export const invitePath = (code: string): string => `${INVITE_PATH_PREFIX}${code}`;

/** Where a link stands right now. Order matters: a cancelled link reads as cancelled even if it also ended. */
export const readInviteState = ({
	cancelledAt,
	expiresAt,
	maxUses,
	uses,
	now = new Date(),
}: {
	cancelledAt: Date | string | null;
	expiresAt: Date | string | null;
	maxUses: number | null;
	uses: number;
	now?: Date;
}): InviteState => {
	if (cancelledAt) return "cancelled";
	if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "ended";
	if (maxUses !== null && uses >= maxUses) return "full";
	return "open";
};

export const placesLeft = ({ maxUses, uses }: { maxUses: number | null; uses: number }): number | null =>
	maxUses === null ? null : Math.max(0, maxUses - uses);
