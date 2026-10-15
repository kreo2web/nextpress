import { describe, expect, it } from "vitest";
import {
	FLUID_HEADING_CSS,
	GLOBAL_BODY_TYPE_CSS,
	MIN_FORM_FONT_SIZE,
	MIN_TOUCH_TARGET_PX,
	PROSE_MAX_WIDTH,
	RESPONSIVE_TIERS,
	SPACING_BY_TIER,
	deviceViewToTier,
	widthPxToTier,
} from "./responsive-scales.js";

describe("responsive-scales", () => {
	it("defines three viewport tiers aligned with Tailwind breakpoints", () => {
		expect(RESPONSIVE_TIERS.mobile.maxWidthPx).toBe(767);
		expect(RESPONSIVE_TIERS.medium.minWidthPx).toBe(768);
		expect(RESPONSIVE_TIERS.large.minWidthPx).toBe(1024);
	});

	it("maps device views and pixel widths to tiers", () => {
		expect(deviceViewToTier("mobile")).toBe("mobile");
		expect(deviceViewToTier("tablet")).toBe("medium");
		expect(deviceViewToTier("desktop")).toBe("large");
		expect(widthPxToTier(390)).toBe("mobile");
		expect(widthPxToTier(768)).toBe("medium");
		expect(widthPxToTier(1280)).toBe("large");
	});

	it("exports spacing, typography, and touch constants", () => {
		expect(SPACING_BY_TIER.containerPadding.mobile).toBe("16px");
		expect(SPACING_BY_TIER.containerPadding.large).toBe("24px");
		expect(PROSE_MAX_WIDTH).toBe("65ch");
		expect(MIN_TOUCH_TARGET_PX).toBe(44);
		expect(MIN_FORM_FONT_SIZE).toBe("16px");
		expect(FLUID_HEADING_CSS).toContain("clamp(");
		expect(FLUID_HEADING_CSS).toContain("wp-block-post-title");
		expect(FLUID_HEADING_CSS).toContain("cqw");
		expect(FLUID_HEADING_CSS).toContain("text-wrap: balance");
		expect(FLUID_HEADING_CSS).toContain("h6.wp-block-heading");
		expect(GLOBAL_BODY_TYPE_CSS).toContain("text-wrap: pretty");
		expect(GLOBAL_BODY_TYPE_CSS).toContain(".wp-block-paragraph");
	});
});
