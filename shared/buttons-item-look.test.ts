import { describe, expect, it } from "vitest";
import { buttonsItemLinkStyle, readButtonsItemLook, readButtonsItemSize } from "./buttons-item-look.js";
import { THEME_BUTTON_FILL, THEME_BUTTON_TEXT } from "./button-look.js";

describe("buttonsItemLinkStyle", () => {
	it("defaults to a solid themed chip at LG", () => {
		expect(readButtonsItemLook(undefined)).toBe("solid");
		expect(readButtonsItemSize(undefined)).toBe("lg");
		expect(buttonsItemLinkStyle({ item: {}, orientation: "horizontal" })).toMatchObject({
			backgroundColor: THEME_BUTTON_FILL,
			color: THEME_BUTTON_TEXT,
			fontSize: "1rem",
		});
	});

	it("paints ghost as clear fill plus accent outline", () => {
		const style = buttonsItemLinkStyle({
			item: { look: "ghost", size: "sm" },
			orientation: "vertical",
		});
		expect(style.backgroundColor).toBe("transparent");
		expect(style.color).toBe(THEME_BUTTON_FILL);
		expect(style.border).toBe("1px solid currentColor");
		expect(style.width).toBe("100%");
		expect(style.fontSize).toBe("0.75rem");
	});

	it("keeps a chosen fill on a solid chip", () => {
		expect(
			buttonsItemLinkStyle({
				item: { backgroundColor: "#111111", color: "#eeeeee", size: "xl" },
				orientation: "horizontal",
			}),
		).toMatchObject({
			backgroundColor: "#111111",
			color: "#eeeeee",
			fontSize: "1.125rem",
		});
	});
});
