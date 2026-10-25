/**
 * How much of a conversation with the page assistant is kept. The server enforces these numbers and the
 * editor trims to the same ones, so there is one place to change them.
 */
export const ASSISTANT_CHAT_LIMITS = {
	/** Chats one person keeps per page or post. Saving a new one past this drops the oldest. */
	chatsPerDocument: 20,
	/** Newest messages kept in a chat; older ones are trimmed away. */
	messagesPerChat: 30,
	/** Largest chat the server saves, measured as JSON. A bigger one is refused, never cut mid-sentence. */
	bytesPerChat: 256 * 1024,
	/** Room beside the messages in a save request (site and page ids). */
	requestEnvelopeBytes: 16 * 1024,
	/** The chat list names a chat after its first request, cut to this many characters. */
	titleLength: 60,
} as const;

/** The newest messages a chat keeps. */
export const keepNewestMessages = <Message>(messages: readonly Message[]): Message[] =>
	messages.slice(-ASSISTANT_CHAT_LIMITS.messagesPerChat);
