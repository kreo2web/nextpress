import { describe, expect, it } from "vitest";
import { postHasCategory, takePageAfterCategoryFilter } from "./post-other";

describe("postHasCategory", () => {
	it("matches a name on other.categories, ignoring case", () => {
		expect(postHasCategory({ other: { categories: ["News"] } }, "news")).toBe(true);
		expect(postHasCategory({ other: { categories: ["News"] } }, "guides")).toBe(false);
		expect(postHasCategory({ other: { categories: ["News"] } }, "")).toBe(true);
	});
});

describe("takePageAfterCategoryFilter", () => {
	it("filters then slices so page 2 is the next matching posts", () => {
		const posts = [
			{ id: "1", other: { categories: ["News"] } },
			{ id: "2", other: { categories: ["Guides"] } },
			{ id: "3", other: { categories: ["News"] } },
			{ id: "4", other: { categories: ["News"] } },
		];
		expect(
			takePageAfterCategoryFilter({ posts, category: "News", page: 2, perPage: 1 }),
		).toEqual({
			posts: [{ id: "3", other: { categories: ["News"] } }],
			total: 3,
		});
	});
});
