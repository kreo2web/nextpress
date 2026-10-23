import type { BlockContent } from "../schema-types.js";
import { readChoice, readCount, readStructuredData, readText } from "./read-structured.js";

export const LOGO_CLOUD_BLOCK_NAME = "core/logo-cloud";

export const LOGO_CLOUD_LAYOUTS = ["row", "grid"] as const;
export type LogoCloudLayout = (typeof LOGO_CLOUD_LAYOUTS)[number];

export type LogoItem = { url: string; alt: string; href: string };

/** Logos of customers or partners: a row (optionally scrolling) or a grid. */
export type LogoCloudContent = {
	logos: LogoItem[];
	layout: LogoCloudLayout;
	/** Columns for the grid layout. */
	columns: number;
	grayscale: boolean;
	/** The row scrolls sideways on a loop (stops for people who ask for less motion). */
	marquee: boolean;
	/** A CSS length, e.g. "40px". */
	logoHeight: string;
};

export const MAX_LOGOS = 24;

export const DEFAULT_LOGO_CLOUD_CONTENT: LogoCloudContent = {
	logos: Array.from({ length: 5 }, (_, index) => ({ url: "/placeholder.png", alt: `Logo ${index + 1}`, href: "" })),
	layout: "row",
	columns: 5,
	grayscale: true,
	marquee: false,
	logoHeight: "40px",
};

const readLogo = (value: unknown): LogoItem | null => {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	const url = readText(item.url).trim();
	return url ? { url, alt: readText(item.alt), href: readText(item.href).trim() } : null;
};

export function readLogoCloudContent(content: BlockContent | undefined): LogoCloudContent {
	const data = readStructuredData(content);
	const logos = Array.isArray(data.logos) ? data.logos.flatMap((item) => readLogo(item) ?? []).slice(0, MAX_LOGOS) : DEFAULT_LOGO_CLOUD_CONTENT.logos;
	return {
		logos,
		layout: readChoice({ value: data.layout, options: LOGO_CLOUD_LAYOUTS, fallback: "row" }),
		columns: readCount({ value: data.columns, min: 2, max: 8, fallback: 5 }),
		grayscale: data.grayscale !== false,
		marquee: data.marquee === true,
		logoHeight: readText(data.logoHeight, "40px").trim() || "40px",
	};
}
