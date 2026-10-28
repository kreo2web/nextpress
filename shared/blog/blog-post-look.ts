import { isJsonObject, type JsonObject, type JsonValue } from "../blocks/docs-types.js";

/**
 * What a post page shows around the writing, set once for the whole blog (`blog.settings.post`).
 * A written post stores only its body; this look is put around it when the post is shown, so a
 * change here reaches every post of the blog at once.
 */
export type BlogPostLook = {
	/** The post's cover picture, under the title. */
	cover: boolean;
	date: boolean;
	readingTime: boolean;
	/** The author's name, picture and bio under the post. */
	author: boolean;
	/** Links to the post before and after this one. */
	prevNext: boolean;
	comments: boolean;
};

export const DEFAULT_BLOG_POST_LOOK: BlogPostLook = { cover: true, date: true, readingTime: true, author: true, prevNext: true, comments: true };

const LOOK_KEYS = Object.keys(DEFAULT_BLOG_POST_LOOK) as (keyof BlogPostLook)[];

/** The look saved in a blog's settings; anything missing or not a yes/no keeps its default. */
export function readBlogPostLook(settings: JsonValue | undefined): BlogPostLook {
	const saved: JsonObject = isJsonObject(settings) && isJsonObject(settings.post) ? settings.post : {};
	return Object.fromEntries(LOOK_KEYS.map((key) => [key, typeof saved[key] === "boolean" ? saved[key] : DEFAULT_BLOG_POST_LOOK[key]])) as BlogPostLook;
}

/** A blog's settings with the look changed, everything else in them kept. */
export function writeBlogPostLook({ settings, look }: { settings: JsonValue | undefined; look: Partial<BlogPostLook> }): JsonObject {
	const current: JsonObject = isJsonObject(settings) ? settings : {};
	return { ...current, post: { ...readBlogPostLook(settings), ...look } };
}
