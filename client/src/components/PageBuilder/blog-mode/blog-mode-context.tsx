import { createContext, useContext } from "react";
import type { BlogPostLook } from "@shared/blog/blog-post-look";
import type { Blog, BlockConfig } from "@shared/schema-types";

/** The right panel's tabs: the post, the whole blog, and the picked block. */
export type BlogPanelTab = "post" | "blog" | "block";

export type BlogModeValue = {
	blog: Blog | undefined;
	blogLoading: boolean;
	blogFailed: boolean;
	/** What a post page shows, for the whole blog. */
	look: BlogPostLook;
	/** Changes the look for every post of the blog; false when it could not be saved (already said in plain words). */
	saveLook: (patch: Partial<BlogPostLook>) => Promise<boolean>;
	savingLook: boolean;
	tab: BlogPanelTab;
	setTab: (tab: BlogPanelTab) => void;
	selectedBlock: BlockConfig | null;
	/** Adds a block of this kind to the post's body: after the picked block, else at the end. */
	insertBlock: (name: string) => void;
};

const BlogModeContext = createContext<BlogModeValue | null>(null);

export const BlogModeContextProvider = BlogModeContext.Provider;

/** Null outside the blog writing editor. */
export const useBlogMode = (): BlogModeValue | null => useContext(BlogModeContext);

/** For screens that only exist in the blog writing editor: a missing provider is a wiring mistake. */
export function useRequiredBlogMode(): BlogModeValue {
	const value = useContext(BlogModeContext);
	if (!value) throw new Error("This screen belongs to the blog writing editor and needs BlogModeProvider above it.");
	return value;
}
