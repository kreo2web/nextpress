import { describe, expect, it } from "vitest";
import { mediaTextAlignItems, mediaTextPaneBasis } from "./media-text-layout";

describe("mediaTextPaneBasis", () => {
	it("splits the row and clamps extreme percents", () => {
		expect(mediaTextPaneBasis(50)).toEqual({ media: "50%", text: "50%" });
		expect(mediaTextPaneBasis(70)).toEqual({ media: "70%", text: "30%" });
		expect(mediaTextPaneBasis(5)).toEqual({ media: "10%", text: "90%" });
	});
});

describe("mediaTextAlignItems", () => {
	it("maps top and bottom to flex alignment", () => {
		expect(mediaTextAlignItems("top")).toBe("flex-start");
		expect(mediaTextAlignItems("bottom")).toBe("flex-end");
		expect(mediaTextAlignItems("center")).toBe("center");
	});
});
