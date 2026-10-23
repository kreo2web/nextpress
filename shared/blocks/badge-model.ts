import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const BADGE_BLOCK_NAME = "core/badge";

export const BADGE_TONES = ["accent", "neutral", "success", "warning", "danger"] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];
export const BADGE_LOOKS = ["soft", "outline", "solid"] as const;
export type BadgeLook = (typeof BADGE_LOOKS)[number];

/** A small label: the eyebrow above a section heading ("New", "Pricing") or a status pill. */
export type BadgeContent = { text: string; tone: BadgeTone; look: BadgeLook };

export const DEFAULT_BADGE_CONTENT: BadgeContent = { text: "New", tone: "accent", look: "soft" };

export function readBadgeContent(content: BlockContent | undefined): BadgeContent {
	const data = readStructuredData(content);
	return {
		text: readText(data.text, DEFAULT_BADGE_CONTENT.text),
		tone: readChoice({ value: data.tone, options: BADGE_TONES, fallback: "accent" }),
		look: readChoice({ value: data.look, options: BADGE_LOOKS, fallback: "soft" }),
	};
}
