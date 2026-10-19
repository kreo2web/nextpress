/**
 * Plain-language answers for Settings → AI. Each says what happened and what to do next, with no
 * mention of how the checks work.
 */
export const AI_SETTINGS_MESSAGES = {
	signIn: "Sign in again to continue.",
	pickSite: "Pick a site first.",
	noSiteAccess: "You don't have access to this site.",
	notAllowed: "Only this site's owner or admins can change the assistant's settings.",
	rateLimited: "Too many saves. Wait a few minutes, then try again.",
	tooManyChecks: "Too many requests. Wait a moment, then try again.",
	invalidRequest: "Some of the details aren't right. Check the form and try again.",
	invalidKey: "That key has characters that can't be used. Paste it again exactly as your provider gave it.",
	invalidModel: "Enter the model's name, for example the one shown in your provider's dashboard.",
	keyNeeded: "Enter your key to save these settings.",
	keyNeededAfterChange: "You changed the provider or address, so enter a key for it.",
	keyUnreadable: "The saved key can't be read any more. Enter it again.",
	addressNeeded: "Enter the address of your AI service.",
	addressNotUsed: "This provider doesn't use an address. Clear it and save again.",
	addressInvalid: "That address doesn't look right. Enter it like https://example.com/v1.",
	addressHasLogin: "Remove the user name and password from the address. Put the key in the key field instead.",
	addressNeedsHttps: "Use a secure address that starts with https:// for a service on the internet.",
	addressNotPublic:
		"That address isn't reachable from the internet. Use a public https address, or ask the main site's admin to add a local one.",
	addressNotAllowed: "That address can't be used. Use the address your AI service gave you.",
	addressLookupFailed: "We couldn't find that address. Check the spelling, then try again.",
	notReady: "Keys can't be saved on this server yet. Ask whoever runs the server to finish setting it up, then try again.",
	saveFailed: "The settings couldn't be saved. Try again.",
	loadFailed: "The settings couldn't be loaded. Try again.",
	removeFailed: "The settings couldn't be removed. Try again.",
	testNotAvailable: "Testing the connection isn't available yet.",
	testNotConfigured: "Save the settings first, then test the connection.",
	testFailed: "The connection test couldn't run. Try again.",
} as const;

/**
 * Plain-language answers for the in-editor assistant and "Test connection".
 * Each says what happened and what to do next, with no mention of keys, prompts, or how the checks work.
 */
export const AI_ASSISTANT_MESSAGES = {
	signIn: AI_SETTINGS_MESSAGES.signIn,
	pickSite: AI_SETTINGS_MESSAGES.pickSite,
	noSiteAccess: AI_SETTINGS_MESSAGES.noSiteAccess,
	notAllowed: "You can't edit this page.",
	pageMissing: "That page could not be found.",
	notConfigured: "The assistant isn't set up for this site yet. A site admin can turn it on in Settings → AI.",
	keyUnreadable: AI_SETTINGS_MESSAGES.keyUnreadable,
	alreadyRunning: "The assistant is already working on a page for you.",
	hourlyLimit: "You've asked the assistant too many times this hour. Try again later.",
	invalidRequest: "Some of the details aren't right. Check the page and try again.",
	runFailed: "The assistant couldn't start. Try again.",
	keyRefused: "The saved key was refused. A site admin can replace it in Settings → AI.",
	unknownModel: "That model name isn't available on this service.",
	busyOrQuota: "The AI service is busy or out of credit. Try again in a minute.",
	noAnswer: "The AI service didn't answer. Try again in a moment.",
	noToolUse: "This model can chat but can't use tools, so it can't build pages.",
	testOk: "The connection works. This model can use tools.",
} as const;
