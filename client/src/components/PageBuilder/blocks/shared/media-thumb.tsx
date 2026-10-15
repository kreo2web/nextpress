import type { JSX } from "react";
import { isSafePublicMediaUrl } from "@shared/bind-post-list";
import { extractYouTubeId, isYouTubeUrl } from "@shared/video-embed";

export type MediaThumbKind = "image" | "video" | "audio" | "any";

function looksLikeVideo(url: string): boolean {
	if (isYouTubeUrl(url)) return true;
	return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

const thumbClassName = "mt-2 max-h-36 w-full bg-transparent object-contain";

/**
 * Small picture of the chosen file for settings panels. The address stays in the field below;
 * this is so people see the photo, not a path. No fill — pictures stay see-through unless the
 * file itself has a background.
 */
export function MediaThumb({
	url,
	kind,
}: {
	url: string;
	kind: MediaThumbKind;
}): JSX.Element | null {
	const trimmed = url.trim();
	if (kind === "audio" || !trimmed) return null;

	if ((kind === "video" || kind === "any") && isYouTubeUrl(trimmed)) {
		const id = extractYouTubeId(trimmed);
		if (!id) return null;
		return (
			<img
				src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
				alt=""
				className={thumbClassName}
			/>
		);
	}

	if (!isSafePublicMediaUrl(trimmed)) return null;

	const showVideo = kind === "video" || (kind === "any" && looksLikeVideo(trimmed));
	if (showVideo) {
		return (
			<video
				src={trimmed}
				muted
				playsInline
				preload="metadata"
				className={thumbClassName}
			/>
		);
	}

	if (kind === "image" || kind === "any") {
		return <img src={trimmed} alt="" className={thumbClassName} />;
	}

	return null;
}
