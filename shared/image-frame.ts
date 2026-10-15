import type { CSSProperties } from "react";

const IMAGE_FIT_VALUES = ["cover", "contain", "fill", "none", "scale-down"] as const;
export type ImageFit = (typeof IMAGE_FIT_VALUES)[number];

/** Style-tab ratio chips for pictures (Natural leaves the file's own box). */
export const IMAGE_ASPECT_PRESETS = [
	{ value: "auto", label: "Natural", accessibleName: "Natural auto" },
	{ value: "1/1", label: "Square", accessibleName: "Square 1 by 1" },
	{ value: "4/3", label: "Standard", accessibleName: "Standard 4 by 3" },
	{ value: "16/9", label: "Wide", accessibleName: "Wide 16 by 9" },
	{ value: "3/2", label: "Tall", accessibleName: "Tall 3 by 2" },
	{ value: "21/9", label: "Cinema", accessibleName: "Cinema 21 by 9" },
] as const;

export type ImageAspectPreset = (typeof IMAGE_ASPECT_PRESETS)[number]["value"];

export function isImageAspectPreset(value: string): value is ImageAspectPreset {
	return IMAGE_ASPECT_PRESETS.some((preset) => preset.value === value);
}

export const IMAGE_FIT_PRESETS: { value: ImageFit; label: string; accessibleName: string }[] = [
	{ value: "cover", label: "Crop to fill", accessibleName: "Crop to fill" },
	{ value: "contain", label: "Fit", accessibleName: "Fit the whole image" },
	{ value: "fill", label: "Stretch", accessibleName: "Stretch" },
	{ value: "none", label: "None", accessibleName: "None" },
	{ value: "scale-down", label: "Scale down", accessibleName: "Scale down" },
];

/** Drop empty / `auto` so the file's own size can still hold the box. */
export function readCssAspectRatio(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed === "" || trimmed === "auto") return undefined;
	return trimmed;
}

export function readImageFit(value: unknown): ImageFit | undefined {
	if (typeof value !== "string") return undefined;
	return IMAGE_FIT_VALUES.find((fit) => fit === value);
}

/**
 * One picture box for the editor canvas and the published page.
 * Fit + a ratio (saved or from the file) crops inside a frame; otherwise the
 * picture keeps its own ratio and never overflows the column.
 */
export function imageFrame({
	objectFit,
	aspectRatio,
	intrinsicWidth,
	intrinsicHeight,
	styles,
}: {
	objectFit?: unknown;
	aspectRatio?: unknown;
	intrinsicWidth?: number;
	intrinsicHeight?: number;
	styles?: CSSProperties;
}): {
	cropInFrame: boolean;
	frameRatio?: string;
	imageStyle: CSSProperties;
} {
	const fit = readImageFit(objectFit) ?? readImageFit(styles?.objectFit);
	const explicit =
		readCssAspectRatio(aspectRatio) ??
		readCssAspectRatio(typeof styles?.aspectRatio === "string" ? styles.aspectRatio : undefined);
	const intrinsicRatio =
		intrinsicWidth && intrinsicHeight ? `${intrinsicWidth} / ${intrinsicHeight}` : undefined;
	const frameRatio = explicit ?? intrinsicRatio;
	const cropInFrame = Boolean(fit && frameRatio);

	if (cropInFrame && fit && frameRatio) {
		return {
			cropInFrame: true,
			frameRatio,
			imageStyle: {
				width: "100%",
				height: "100%",
				objectFit: fit,
				display: "block",
			},
		};
	}

	return {
		cropInFrame: false,
		frameRatio,
		imageStyle: {
			...styles,
			maxWidth: styles?.maxWidth ?? "100%",
			height: styles?.height ?? "auto",
			...(explicit
				? { aspectRatio: explicit }
				: intrinsicRatio
					? { aspectRatio: intrinsicRatio }
					: {}),
			...(fit ? { objectFit: fit } : {}),
		},
	};
}
