import { describe, expect, it } from "vitest";
import { safeCssBox, safeCssLength } from "./css-safe";

describe("safeCssLength", () => {
	it("keeps a unitless zero so None padding can publish", () => {
		expect(safeCssLength("0")).toBe("0");
		expect(safeCssLength("0.0")).toBe("0.0");
		expect(safeCssLength("-0")).toBe("-0");
	});

	it("still keeps ordinary lengths and refuses breakouts", () => {
		expect(safeCssLength("20px")).toBe("20px");
		expect(safeCssLength("1.5rem")).toBe("1.5rem");
		expect(safeCssLength("calc(1px + 2px)")).toBeUndefined();
		expect(safeCssLength("10px;body{")).toBeUndefined();
	});
});

describe("safeCssBox", () => {
	it("accepts None as one or more zeros", () => {
		expect(safeCssBox("0")).toBe("0");
		expect(safeCssBox("0 0")).toBe("0 0");
		expect(safeCssBox("0 24px")).toBe("0 24px");
	});
});
