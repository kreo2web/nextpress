import { fresh, structured } from "./content.js";
import { DEFAULT_EXCERPT_MAX_LENGTH, DEFAULT_READ_MORE_TEXT } from "../excerpt-display.js";
import type { WrittenBlockEntry } from "./types.js";

/** One copy of each post default. The editor imports these; the entries below use them. */
export const POST_TITLE_DEFAULT_CONTENT = {
	text: "Post Title",
	tag: "h1" as const,
	className: "",
};

export const POST_EXCERPT_DEFAULT_CONTENT = {
	text: "This is a brief summary of the post content that gives readers a preview of what to expect...",
	maxLength: DEFAULT_EXCERPT_MAX_LENGTH,
	showReadMore: true,
	readMoreText: DEFAULT_READ_MORE_TEXT,
	className: "",
};

export const POST_FEATURED_IMAGE_DEFAULT_CONTENT = {
	url: "",
	alt: "Featured image",
	caption: "",
	objectFit: "cover" as const,
	aspectRatio: "16/9",
	className: "",
};

export const POST_LIST_DEFAULT_CONTENT = {
	layout: "grid" as const,
	postsPerPage: 6,
	morePosts: "show-more" as const,
	showExcerpt: true,
	showFeaturedImage: true,
	showDate: true,
	showAuthor: true,
	blogId: "",
	category: "",
	orderBy: "date" as const,
	order: "desc" as const,
	openIn: "overlay" as const,
	className: "",
};

export const POST_TOC_DEFAULT_CONTENT = {
	title: "Table of Contents",
	maxDepth: 3,
	ordered: false,
	sticky: false,
	className: "",
};

export const POST_AUTHOR_BOX_DEFAULT_CONTENT = {
	authorId: "",
	postId: "",
	showAvatar: true,
	showBio: true,
	showName: true,
	layout: "horizontal" as const,
	avatarSize: 64,
	className: "",
};

export const POST_COMMENTS_DEFAULT_CONTENT = {
	postId: "",
	showForm: true,
	showCount: true,
	commentsPerPage: 10,
	allowReplies: true,
	className: "",
};

export const POST_NAVIGATION_DEFAULT_CONTENT = {
	postId: "",
	showThumbnail: false,
	showLabel: true,
	prevLabel: "Previous Post",
	nextLabel: "Next Post",
	className: "",
};

export const POST_INFO_DEFAULT_CONTENT = {
	postId: "",
	showDate: true,
	showCategories: true,
	showTags: true,
	showReadTime: true,
	dateFormat: "long" as const,
	layout: "inline" as const,
	className: "",
};

export const POST_PROGRESS_BAR_COLOR = "var(--npb-accent)";
export const POST_PROGRESS_BACKGROUND_COLOR = "transparent";

export const POST_PROGRESS_DEFAULT_CONTENT = {
	color: POST_PROGRESS_BAR_COLOR,
	height: 4,
	position: "top" as const,
	showPercentage: false,
	backgroundColor: POST_PROGRESS_BACKGROUND_COLOR,
	className: "",
};

export const POST_BLOCKS: readonly WrittenBlockEntry[] = [
	{
		name: "post/title",
		label: "Post Title",
		description: "Display the post title as a heading",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_TITLE_DEFAULT_CONTENT),
		defaultStyles: { margin: "0" },
	},
	{
		name: "post/excerpt",
		label: "Post Excerpt",
		description: "Display a summary excerpt of the post",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_EXCERPT_DEFAULT_CONTENT),
		defaultStyles: { margin: "0" },
	},
	{
		name: "post/featured-image",
		label: "Featured Image",
		description: "Display and set the post featured image",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_FEATURED_IMAGE_DEFAULT_CONTENT),
		defaultStyles: { width: "100%" },
	},
	{
		name: "post/list",
		label: "Post List",
		description: "Display a list of posts in grid, list, or card layout",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_LIST_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
	// Stored plain (no `kind` wrapper): these three definitions skip the editor's serializer, so an inserted block keeps the plain shape.
	{
		name: "post/toc",
		label: "Table of Contents",
		description: "Auto-generated table of contents from page headings",
		category: "post",
		kind: "block",
		defaultContent: () => fresh(POST_TOC_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
	{
		name: "post/author-box",
		label: "Author Box",
		description: "Display the post author's avatar, name, and bio",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_AUTHOR_BOX_DEFAULT_CONTENT),
		defaultStyles: { margin: "0 0 1em 0" },
	},
	{
		name: "post/comments",
		label: "Post Comments",
		description: "Display post comments and a comment submission form",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_COMMENTS_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
	{
		name: "post/navigation",
		label: "Post Navigation",
		description: "Navigate between previous and next posts",
		category: "post",
		kind: "block",
		defaultContent: () => structured(POST_NAVIGATION_DEFAULT_CONTENT),
		defaultStyles: { margin: "2em 0" },
	},
	{
		name: "post/info",
		label: "Post Info",
		description: "Display post metadata: date, categories, tags, and read time",
		category: "post",
		kind: "block",
		defaultContent: () => fresh(POST_INFO_DEFAULT_CONTENT),
		defaultStyles: { margin: "0.5em 0" },
	},
	{
		name: "post/progress",
		label: "Reading Progress",
		description: "Show a reading progress indicator bar",
		category: "post",
		kind: "block",
		defaultContent: () => fresh(POST_PROGRESS_DEFAULT_CONTENT),
		defaultStyles: {},
	},
];
