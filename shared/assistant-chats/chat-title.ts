import { ASSISTANT_CHAT_LIMITS } from "./limits";

/** What a chat is called while it has no request text to name it by. */
export const NEW_CHAT_TITLE = "New chat";

type TitleSource = { role: string; parts: ReadonlyArray<object> };

const readTextPart = (part: object): string =>
	"type" in part && part.type === "text" && "text" in part && typeof part.text === "string" ? part.text : "";

/**
 * The chat's name: the first thing the person asked, tidied. WHY: the list then reads like their own words.
 * Whitespace is collapsed and a long request is cut with an ellipsis.
 */
export const deriveChatTitle = (messages: ReadonlyArray<TitleSource>): string => {
	const firstRequest = messages.find((message) => message.role === "user");
	const text = (firstRequest?.parts ?? [])
		.map(readTextPart)
		.filter((piece) => piece !== "")
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	if (text === "") return NEW_CHAT_TITLE;
	const { titleLength } = ASSISTANT_CHAT_LIMITS;
	return text.length > titleLength ? `${text.slice(0, titleLength - 1).trimEnd()}…` : text;
};
