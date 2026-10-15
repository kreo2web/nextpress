import type { CSSProperties } from "react";

/** Flex alignment for media-and-text, from the saved vertical choice. */
export function mediaTextAlignItems(
	verticalAlignment: string | undefined,
): NonNullable<CSSProperties["alignItems"]> {
	if (verticalAlignment === "top") return "flex-start";
	if (verticalAlignment === "bottom") return "flex-end";
	return "center";
}

/** Split of the row: media pane vs text pane. */
export function mediaTextPaneBasis(mediaWidth: number | undefined): { media: string; text: string } {
	const width =
		typeof mediaWidth === "number" && Number.isFinite(mediaWidth)
			? Math.min(90, Math.max(10, mediaWidth))
			: 50;
	return { media: `${width}%`, text: `${100 - width}%` };
}
