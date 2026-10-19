import type { InviteState } from "./types";

/** What people read about invite links. Plain words, and a next step where there is one. */
export const INVITE_MESSAGES = {
	notFound: "This invite link doesn't work. Ask the site's admin for a new one.",
	closed: {
		full: "This invite link has no places left. Ask the site's admin for a new one.",
		ended: "This invite link has ended. Ask the site's admin for a new one.",
		cancelled: "This invite link was cancelled. Ask the site's admin for a new one.",
	} satisfies Record<Exclude<InviteState, "open">, string>,
	emailTaken: "Someone already has an account with this email. Sign in, then open the link again.",
	usernameTaken: "That username is taken. Pick another one.",
	roleTooHigh: "You can't give a role above your own.",
	invalid: "Some details were not valid. Check them and try again.",
	tooMany: "Too many tries. Wait a minute and try again.",
	failed: "We couldn't finish joining. Try again in a moment.",
} as const;
