import { describe, expect, it } from "vitest";
import { ASSISTANT_CHAT_LIMITS, deriveChatTitle, keepNewestMessages, NEW_CHAT_TITLE } from "./index";

const user = (text: string) => ({ role: "user", parts: [{ type: "text", text }] });
const assistant = (text: string) => ({ role: "assistant", parts: [{ type: "text", text }] });

describe("deriveChatTitle", () => {
	it("is the first request with whitespace collapsed", () => {
		expect(deriveChatTitle([assistant("Hello"), user("  Make   the hero\n bigger  "), user("Later ask")])).toBe("Make the hero bigger");
	});

	it("cuts a long request with an ellipsis, inside the title length", () => {
		const title = deriveChatTitle([user("word ".repeat(30))]);
		expect(title.endsWith("…")).toBe(true);
		expect(title.length).toBeLessThanOrEqual(ASSISTANT_CHAT_LIMITS.titleLength);
	});

	it("is 'New chat' while there is no request text, including requests made only of other parts", () => {
		expect(deriveChatTitle([assistant("Hello")])).toBe(NEW_CHAT_TITLE);
		expect(deriveChatTitle([{ role: "user", parts: [{ type: "tool-change_blocks" }, { type: "text", text: "   " }] }])).toBe(NEW_CHAT_TITLE);
		expect(deriveChatTitle([])).toBe(NEW_CHAT_TITLE);
	});
});

describe("keepNewestMessages", () => {
	it("keeps the newest 30 and leaves a shorter chat as it is", () => {
		const messages = Array.from({ length: 31 }, (_, index) => index);
		expect(keepNewestMessages(messages)).toEqual(messages.slice(1));
		expect(keepNewestMessages([1, 2, 3])).toEqual([1, 2, 3]);
	});
});
