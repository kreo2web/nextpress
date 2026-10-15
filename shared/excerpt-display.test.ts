import { describe, expect, it } from "vitest";
import { truncateExcerpt } from "./excerpt-display.js";

describe("truncateExcerpt", () => {
	it("leaves short text alone", () => {
		expect(truncateExcerpt({ text: "Hello there", maxLength: 200 })).toEqual({
			truncated: "Hello there",
			wasTruncated: false,
		});
	});

	it("cuts on a word and adds an ellipsis", () => {
		expect(truncateExcerpt({ text: "Hello there friend", maxLength: 12 })).toEqual({
			truncated: "Hello there…",
			wasTruncated: true,
		});
	});
});
