import { fresh, structured } from "./content.js";
import { DEFAULT_DATA as GALLERY_DEFAULT_DATA } from "../gallery-model.js";
import { PLACEHOLDER_IMAGE_ALT, PLACEHOLDER_IMAGE_URL } from "../placeholder-image.js";
import type { WrittenBlockEntry } from "./types.js";

/** One copy of each media default. The editor imports these; the entries below use them. */
export const IMAGE_DEFAULT_CONTENT = {
	kind: "media" as const,
	url: PLACEHOLDER_IMAGE_URL,
	mediaType: "image" as const,
	alt: PLACEHOLDER_IMAGE_ALT,
	caption: "",
	id: undefined,
	sizeSlug: "full" as const,
	align: "" as const,
	linkDestination: "none" as const,
	href: "",
	linkTarget: "_self" as const,
	rel: "",
	title: "",
	className: "",
};

export const VIDEO_DEFAULT_CONTENT = {
	kind: "media" as const,
	mediaType: "video" as const,
	url: "",
	id: undefined,
	poster: "",
	autoplay: false,
	controls: true,
	loop: false,
	muted: false,
	playsInline: true,
	preload: "metadata",
	align: undefined,
	caption: "",
	anchor: "",
	className: "",
};

export const AUDIO_DEFAULT_CONTENT = {
	kind: "media" as const,
	url: "",
	mediaType: "audio" as const,
	id: undefined,
	autoplay: false,
	controls: true,
	loop: false,
	preload: "none",
	align: undefined,
	caption: "",
	anchor: "",
	className: "",
};

export const FILE_DEFAULT_DATA = {
	href: "",
	fileName: "",
	textLinkHref: "",
	textLinkTarget: "_self" as const,
	showDownloadButton: true,
	downloadButtonText: "Download",
	displayPreview: true,
	fileSize: "",
	className: "",
};

export const FILE_DEFAULT_CONTENT = {
	kind: "structured" as const,
	data: FILE_DEFAULT_DATA,
};

export const COVER_DEFAULT_DATA = {
	url: "",
	alt: "",
	hasParallax: false,
	dimRatio: 50,
	minHeight: 400,
	contentPosition: "center center",
	customOverlayColor: "#000000",
	backgroundType: "image" as const,
	focalPoint: { x: 0.5, y: 0.5 },
	innerContent: '<p style="font-size: 2.5em; font-weight: bold;">Write title…</p>',
	className: "",
};

export const COVER_DEFAULT_CONTENT = {
	kind: "structured" as const,
	data: COVER_DEFAULT_DATA,
};

export const MEDIA_TEXT_DEFAULT_DATA = {
	mediaId: undefined,
	mediaUrl: PLACEHOLDER_IMAGE_URL,
	mediaType: "image" as const,
	mediaAlt: PLACEHOLDER_IMAGE_ALT,
	mediaPosition: "left" as const,
	mediaWidth: 50,
	isStackedOnMobile: true,
	imageFill: false,
	verticalAlignment: "center" as const,
	href: "",
	linkTarget: "_self" as const,
	rel: "",
	title: "",
	content: "<p>Add your content…</p>",
	anchor: "",
	className: "",
};

export const MEDIA_TEXT_DEFAULT_CONTENT = {
	kind: "structured" as const,
	data: MEDIA_TEXT_DEFAULT_DATA,
};

export const MEDIA_BLOCKS: readonly WrittenBlockEntry[] = [
	{
		name: "core/image",
		label: "Image",
		description: "Add an image",
		category: "media",
		alsoIn: ["docs"],
		kind: "block",
		defaultContent: () => fresh(IMAGE_DEFAULT_CONTENT),
		defaultStyles: {
			width: "100%",
			maxWidth: "100%",
			height: "auto",
		},
	},
	{
		name: "core/gallery",
		label: "Gallery",
		description: "Display multiple images in a rich gallery",
		category: "media",
		kind: "block",
		defaultContent: () => structured(GALLERY_DEFAULT_DATA),
		defaultStyles: { width: "100%", margin: "1em 0" },
	},
	{
		name: "core/video",
		label: "Video",
		description: "Add a video player",
		category: "media",
		kind: "block",
		defaultContent: () => fresh(VIDEO_DEFAULT_CONTENT),
		defaultStyles: { width: "100%" },
	},
	{
		name: "core/audio",
		label: "Audio",
		description: "Add an audio player",
		category: "media",
		kind: "block",
		defaultContent: () => fresh(AUDIO_DEFAULT_CONTENT),
		defaultStyles: { width: "100%" },
	},
	{
		name: "core/file",
		label: "File",
		description: "Add a link to a downloadable file",
		category: "media",
		kind: "block",
		defaultContent: () => fresh(FILE_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
	{
		name: "core/cover",
		label: "Cover",
		description: "Add an image or video with a text overlay",
		category: "media",
		kind: "block",
		defaultContent: () => fresh(COVER_DEFAULT_CONTENT),
		defaultStyles: {},
	},
	{
		name: "core/media-text",
		label: "Media & Text",
		description: "Display media and text side by side",
		category: "media",
		kind: "block",
		defaultContent: () => fresh(MEDIA_TEXT_DEFAULT_CONTENT),
		defaultStyles: { margin: "1em 0" },
	},
];
