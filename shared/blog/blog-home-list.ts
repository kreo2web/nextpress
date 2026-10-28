import { isJsonObject, type JsonObject, type JsonValue } from "../blocks/docs-types.js";

/**
 * How a blog's home page lists its posts: the post list on the blog's own page, read and written in
 * the words of the blog setup and the writing editor's Blog tab.
 */
export const BLOG_HOME_LAYOUTS = ["cards", "grid", "list"] as const;
export type BlogHomeLayout = (typeof BLOG_HOME_LAYOUTS)[number];

export type BlogHomeList = {
	layout: BlogHomeLayout;
	showExcerpt: boolean;
	showFeaturedImage: boolean;
	showDate: boolean;
	showAuthor: boolean;
};

export const DEFAULT_BLOG_HOME_LIST: BlogHomeList = { layout: "cards", showExcerpt: true, showFeaturedImage: true, showDate: true, showAuthor: true };

/** The blog's home page as the editor shows it: where it is, whether it is live, and its list. */
export type BlogHome = { pageId: string; address: string; status: string; list: BlogHomeList };

const SWITCHES = ["showExcerpt", "showFeaturedImage", "showDate", "showAuthor"] as const;

/** The list settings held by a post list block's fields; anything missing keeps its default. */
export function readBlogHomeList(fields: JsonValue | undefined): BlogHomeList {
	const data: JsonObject = isJsonObject(fields) ? fields : {};
	const layout = BLOG_HOME_LAYOUTS.find((option) => option === data.layout) ?? DEFAULT_BLOG_HOME_LIST.layout;
	const switches = Object.fromEntries(SWITCHES.map((key) => [key, typeof data[key] === "boolean" ? data[key] : DEFAULT_BLOG_HOME_LIST[key]]));
	return { layout, ...switches } as BlogHomeList;
}

/** A change to the list from the screens, checked: unknown layouts and non yes/no values are dropped. */
export function readBlogHomeListPatch(input: JsonValue | undefined): Partial<BlogHomeList> {
	if (!isJsonObject(input)) return {};
	const layout = BLOG_HOME_LAYOUTS.find((option) => option === input.layout);
	const switches = Object.fromEntries(SWITCHES.filter((key) => typeof input[key] === "boolean").map((key) => [key, input[key]]));
	return { ...(layout ? { layout } : {}), ...switches };
}
