import { describe, expect, it } from "vitest";
import { buttonsGroupStyle } from "./buttons-group-style";

describe("buttonsGroupStyle", () => {
	it("stacks and stretches on vertical", () => {
		const style = buttonsGroupStyle({ layout: "center", orientation: "vertical" });
		expect(style.flexDirection).toBe("column");
		expect(style.justifyContent).toBe("center");
		expect(style.alignItems).toBe("stretch");
		expect(style.gap).toBe("0.75em");
	});

	it("wraps a row and maps right to flex-end", () => {
		const style = buttonsGroupStyle({ layout: "right", orientation: "horizontal" });
		expect(style.flexDirection).toBe("row");
		expect(style.justifyContent).toBe("flex-end");
		expect(style.flexWrap).toBe("wrap");
	});
});
