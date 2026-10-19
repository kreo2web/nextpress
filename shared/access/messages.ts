/** What people read when something is refused. Plain words, no internals, no warnings ahead of time. */
export const ACCESS_MESSAGES = {
	signIn: "Sign in to continue.",
	noSite: "You don't have access to this site.",
	notAllowed: "You don't have permission to do that on this site.",
	mainSiteOnly: "Only the main site's admins can do that.",
	notFound: "We couldn't find that.",
	signUpClosed: "This site doesn't take new accounts. Ask the site's admin for an invite link.",
} as const;
