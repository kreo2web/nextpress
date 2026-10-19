import type { IconReference } from "../types/domain.js";
import type { ContainerHtmlTagName, GroupHtmlTagName } from "../types/page-other.js";

/**
 * Content-tab shapes aligned with dashboard block models (`client/.../blocks/*-model.ts`).
 * Persisted as `{ kind: "structured", data }` unless the block uses text/media/html kinds.
 */

/** Group block — Content tab: tagName, layoutPreset (semantics). Style tab: flex/grid layout. */
export type GroupContent = {
	tagName?: GroupHtmlTagName;
	className?: string;
	layoutPreset?: string;
};

/** Container block — Content tab: semantic tag only. Style tab: maxWidth, padding, background. */
export type ContainerContent = {
	tagName?: ContainerHtmlTagName;
	className?: string;
};

/** One button in a buttons row, as the editor saves it. Look, size and colours live on the item. */
export type ButtonItem = {
	/** The editor finds a button by this id; the `blocks.buttons()` builder numbers any left out. */
	id?: string;
	text: string;
	url: string;
	linkTarget?: "_self" | "_blank";
	rel?: string;
	title?: string;
	className?: string;
	look?: "solid" | "ghost";
	size?: "sm" | "md" | "lg" | "xl";
	backgroundColor?: string;
	color?: string;
	borderRadius?: string;
};

/**
 * Buttons row — a plain block that keeps its buttons in `content.data.buttons`, like the editor.
 * Do not put `core/button` blocks inside it.
 */
export type ButtonsContent = {
	buttons?: ButtonItem[];
	layout?: "flex-start" | "center" | "flex-end" | "space-between";
	orientation?: "horizontal" | "vertical";
	className?: string;
};

/** Icon block — Content tab: icon ref, link, label. Style tab: padding, colors. */
export type IconContent = {
	icon: IconReference;
	link: string;
	linkTarget: "_self" | "_blank";
	label: string;
};

export type GalleryImage = {
	id: string | number;
	url: string;
	alt: string;
	caption?: string;
	sizeSlug?: string;
};

export type GalleryContent = {
	images?: GalleryImage[];
	columns?: number;
	imageCrop?: boolean;
	linkTo?: "none" | "media" | "attachment";
	sizeSlug?: string;
	caption?: string;
	className?: string;
};

export type CoverContent = {
	url?: string;
	alt?: string;
	hasParallax?: boolean;
	dimRatio?: number;
	overlayColor?: string;
	minHeight?: number;
	contentPosition?: string;
	customOverlayColor?: string;
	backgroundType?: "image" | "video";
	focalPoint?: { x: number; y: number };
	innerContent?: string;
	className?: string;
};

export type SpacerContent = {
	height?: string;
};

export type SeparatorContent = {
	style?: string;
};

export type DividerContent = {
	style?: string;
};

export type ColumnsContent = {
	layoutMode?: "flex" | "grid";
	minColumnWidth?: string;
	verticalAlignment?: string;
	horizontalAlignment?: string;
	columnVerticalAlignment?: string;
	columnHorizontalAlignment?: string;
	columns?: number;
};

export type ListContent = {
	ordered?: boolean;
	items?: string[];
};

export type MediaTextContent = {
	mediaUrl?: string;
	mediaType?: "image" | "video";
	text?: string;
	mediaPosition?: "left" | "right";
};

export type FileContent = {
	url?: string;
	filename?: string;
	showDownloadButton?: boolean;
};

export type TableContent = {
	headers?: string[];
	rows?: string[][];
};

export type PostListContent = {
	layout?: string;
	postsPerPage?: number;
	/** Extra posts: hide them, Show more, or numbered pages. */
	morePosts?: "none" | "show-more" | "pages";
	showExcerpt?: boolean;
	showFeaturedImage?: boolean;
	showDate?: boolean;
	showAuthor?: boolean;
	blogId?: string;
	orderBy?: string;
	order?: string;
	/** Overlay keeps the grid; page navigates to `/post/{slug}`. */
	openIn?: "overlay" | "page";
};

export type PostTitleContent = {
	/** @deprecated The editor ignores this and always links the title where it makes sense. Removed in 0.4. */
	showLink?: boolean;
};

export type PostFeaturedImageContent = {
	aspectRatio?: string;
	objectFit?: string;
};

export type PostTocContent = {
	title?: string;
	maxDepth?: number;
};

export type PostAuthorBoxContent = {
	showAvatar?: boolean;
	showBio?: boolean;
};

export type PostNavigationContent = {
	/** @deprecated The editor ignores this and shows both links when they exist. Removed in 0.4. */
	showPrevious?: boolean;
	/** @deprecated The editor ignores this and shows both links when they exist. Removed in 0.4. */
	showNext?: boolean;
};

export type PostInfoContent = {
	showDate?: boolean;
	/** @deprecated The editor ignores this. Removed in 0.4. */
	showAuthor?: boolean;
	showCategories?: boolean;
};

export type PostProgressContent = {
	position?: string;
};

/** A form: the name shown next to each answer in Forms, and what visitors see once they have sent it. */
export type FormContent = {
	name?: string;
	successMessage?: string;
};

export type InputFieldContent = {
	type?: "text" | "email" | "search" | "password" | "number" | "tel" | "url";
	name?: string;
	/** Visible text above the field. */
	label?: string;
	/** Stays under the label while people type. */
	helpText?: string;
	placeholder?: string;
	defaultValue?: string;
	required?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
};

export type TextareaFieldContent = {
	name?: string;
	/** Visible text above the field. */
	label?: string;
	/** Stays under the label while people type. */
	helpText?: string;
	placeholder?: string;
	defaultValue?: string;
	rows?: number;
	required?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
};

export type SelectFieldContent = {
	name?: string;
	/** Visible text above the field. */
	label?: string;
	/** Stays under the label while people type. */
	helpText?: string;
	placeholder?: string;
	defaultValue?: string;
	options?: Array<{ label: string; value: string }>;
	required?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
};
