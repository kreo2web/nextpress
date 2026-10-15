import { describe, expect, it } from "vitest";
import { imageFrame, isImageAspectPreset, readCssAspectRatio } from "./image-frame.js";

describe("imageFrame", () => {
	it("uses the file size as the box when no ratio is saved", () => {
		const frame = imageFrame({ intrinsicWidth: 800, intrinsicHeight: 600 });
		expect(frame.cropInFrame).toBe(false);
		expect(frame.imageStyle.aspectRatio).toBe("800 / 600");
		expect(frame.imageStyle.maxWidth).toBe("100%");
		expect(frame.imageStyle.height).toBe("auto");
	});

	it("lets a saved ratio win over the file size", () => {
		const frame = imageFrame({
			aspectRatio: "16/9",
			intrinsicWidth: 800,
			intrinsicHeight: 600,
		});
		expect(frame.imageStyle.aspectRatio).toBe("16/9");
	});

	it("treats auto and empty as missing", () => {
		expect(readCssAspectRatio("auto")).toBeUndefined();
		expect(readCssAspectRatio("   ")).toBeUndefined();
		expect(imageFrame({ aspectRatio: "auto", intrinsicWidth: 800, intrinsicHeight: 600 }).imageStyle.aspectRatio).toBe(
			"800 / 600",
		);
	});

	it("crops inside the frame when fit and a ratio are both set", () => {
		const frame = imageFrame({ objectFit: "contain", aspectRatio: "21/9" });
		expect(frame.cropInFrame).toBe(true);
		expect(frame.frameRatio).toBe("21/9");
		expect(frame.imageStyle).toMatchObject({
			width: "100%",
			height: "100%",
			objectFit: "contain",
		});
		expect(frame.imageStyle.aspectRatio).toBeUndefined();
	});

	it("knows the Style-tab ratio chips", () => {
		expect(isImageAspectPreset("1/1")).toBe(true);
		expect(isImageAspectPreset("16/9")).toBe(true);
		expect(isImageAspectPreset("auto")).toBe(true);
		expect(isImageAspectPreset("16 / 9")).toBe(false);
	});

	it("crops to the file ratio when fit is set without a saved ratio", () => {
		const frame = imageFrame({
			objectFit: "cover",
			intrinsicWidth: 800,
			intrinsicHeight: 600,
		});
		expect(frame.cropInFrame).toBe(true);
		expect(frame.frameRatio).toBe("800 / 600");
	});
});
