import { AI_ASSISTANT_MESSAGES } from "../ai-builder/messages";

/**
 * Plain-language answers for saved assistant chats. Each says what happened and what to do next, with
 * nothing about how saving works. The two `save…` lines are the quiet ones the editor shows under the chat.
 */
export const ASSISTANT_CHAT_MESSAGES = {
	signIn: AI_ASSISTANT_MESSAGES.signIn,
	noSiteAccess: AI_ASSISTANT_MESSAGES.noSiteAccess,
	pageMissing: AI_ASSISTANT_MESSAGES.pageMissing,
	chatMissing: "That chat could not be found.",
	invalidRequest: "Some of the details aren't right. Reload the editor and try again.",
	tooLong: "This chat is too long to save. Start a new chat to keep going.",
	tooManyChanges: "Too many chat changes in a short time. Wait a moment, then try again.",
	saveFailed: "This chat couldn't be saved. Try again.",
	loadFailed: "Your saved chats couldn't be loaded. Try again.",
	openFailed: "That chat couldn't be opened. Try again.",
	deleteFailed: "That chat couldn't be deleted. Try again.",
	/** Shown while saving keeps failing and the editor keeps trying. */
	saveRetrying: "Couldn't save this chat yet. It will try again.",
	/** Shown when trying again cannot help (the person was signed out, lost access, or the page is gone). */
	saveRefused: "This chat couldn't be saved.",
} as const;
