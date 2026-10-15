import { BREAKPOINT_MAP } from "./token-resolution.js";

/** Canonical viewport tiers aligned with Tailwind breakpoints. */
export type ViewportTier = "mobile" | "medium" | "large";

export const RESPONSIVE_TIERS = {
	mobile: { maxWidthPx: 767, label: "Mobile (<768px)" },
	medium: { minWidthPx: 768, maxWidthPx: 1023, label: "Tablet (768–1023px)" },
	large: { minWidthPx: 1024, label: "Desktop (≥1024px)" },
} as const;

export { BREAKPOINT_MAP };

/**
 * Fluid heading sizes — applied via publish CSS unless the block has a saved fontSize.
 * `vw` is the fallback; `cqw` follows the page column and the editor phone canvas
 * (`container-name: npb-canvas`).
 */
export const FLUID_HEADING_CSS = `
h1.wp-block-heading, h1.wp-block-post-title,
.wp-block-heading h1,
.wp-block-markdown h1 {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-size: clamp(1.75rem, 5.5cqw, 2.5rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
}
h2.wp-block-heading, h2.wp-block-post-title,
.wp-block-heading h2,
.wp-block-markdown h2 {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-size: clamp(1.5rem, 4.5cqw, 2rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.025em;
}
h3.wp-block-heading, h3.wp-block-post-title,
.wp-block-heading h3,
.wp-block-markdown h3 {
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-size: clamp(1.25rem, 3.5cqw, 1.75rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
h4.wp-block-heading, .wp-block-heading h4,
.wp-block-markdown h4 {
  font-size: clamp(1.125rem, 2.5vw, 1.5rem);
  font-size: clamp(1.125rem, 2.8cqw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
}
h5.wp-block-heading, .wp-block-heading h5,
.wp-block-markdown h5 {
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-size: clamp(1rem, 2.2cqw, 1.25rem);
  font-weight: 600;
  line-height: 1.35;
}
h6.wp-block-heading, .wp-block-heading h6,
.wp-block-markdown h6 {
  font-size: clamp(0.9375rem, 1.8vw, 1.125rem);
  font-size: clamp(0.9375rem, 2cqw, 1.125rem);
  font-weight: 600;
  line-height: 1.4;
}
.wp-block-heading,
.wp-block-post-title,
.wp-block-markdown h1,
.wp-block-markdown h2,
.wp-block-markdown h3,
.wp-block-markdown h4,
.wp-block-markdown h5,
.wp-block-markdown h6,
.np-post-list__title {
  text-wrap: balance;
  overflow-wrap: break-word;
}
`.trim();

/** Body copy: wrap for reading, not for a poster. */
export const GLOBAL_BODY_TYPE_CSS = `
.wp-block-paragraph,
.wp-block-list,
.wp-block-quote,
.wp-block-pullquote,
.wp-block-post-excerpt,
.wp-block-post-info,
.wp-block-post-author-box,
.wp-element-caption,
figcaption,
.wp-block-table,
.wp-block-markdown p,
.wp-block-markdown li,
.wp-block-markdown blockquote,
.np-post-list__excerpt {
  text-wrap: pretty;
  overflow-wrap: break-word;
}
.wp-block-paragraph {
  line-height: 1.65;
}
`.trim();

/** Tier-based spacing values for runtime defaults. */
export const SPACING_BY_TIER = {
	pagePadding: { mobile: "1rem", medium: "1.5rem", large: "2rem 1rem" },
	containerPadding: { mobile: "16px", medium: "20px", large: "24px" },
	groupPadding: { mobile: "1rem", medium: "1.25rem", large: "1.25em 2.375em" },
	blockStackGap: { mobile: "0.5rem", medium: "0.5rem", large: "0.5rem" },
} as const;

export const PROSE_MAX_WIDTH = "65ch";
export const MIN_TOUCH_TARGET_PX = 44;
export const MIN_FORM_FONT_SIZE = "16px";

/** Maps editor device view to viewport tier for default selection. */
export function deviceViewToTier(device: "desktop" | "tablet" | "mobile"): ViewportTier {
	if (device === "mobile") return "mobile";
	if (device === "tablet") return "medium";
	return "large";
}

/** Maps a pixel width to the nearest viewport tier. */
export function widthPxToTier(widthPx: number): ViewportTier {
	if (widthPx < RESPONSIVE_TIERS.medium.minWidthPx) return "mobile";
	if (widthPx < RESPONSIVE_TIERS.large.minWidthPx) return "medium";
	return "large";
}
