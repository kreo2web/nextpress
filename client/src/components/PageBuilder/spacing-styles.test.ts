import { describe, expect, it } from "vitest";
import {
	applySpacingPatch,
	applySpacingShorthandPatch,
	buildSpacingStyles,
	expandSpacingShorthand,
	hasSpacingSide,
	pickSideMode,
	readSpacingSides,
	spacingPairValue,
	spacingPairsPatch,
	spacingPatchForAll,
	spacingPatchForPair,
	spacingShorthand,
	spacingSideKeys,
	spacingSidesMatch,
} from "./spacing-styles";

const EMPTY = { top: "", right: "", bottom: "", left: "" };

describe("expandSpacingShorthand", () => {
	it("follows CSS box rules for 1, 2, 3 and 4 values", () => {
		expect(expandSpacingShorthand("1rem")).toEqual({ top: "1rem", right: "1rem", bottom: "1rem", left: "1rem" });
		expect(expandSpacingShorthand("1rem 2rem")).toEqual({ top: "1rem", right: "2rem", bottom: "1rem", left: "2rem" });
		expect(expandSpacingShorthand("1px 2px 3px")).toEqual({ top: "1px", right: "2px", bottom: "3px", left: "2px" });
		expect(expandSpacingShorthand("1px 2px 3px 4px")).toEqual({ top: "1px", right: "2px", bottom: "3px", left: "4px" });
		expect(expandSpacingShorthand(undefined)).toEqual(EMPTY);
	});

	it("keeps calc() and var() values whole instead of splitting them at their spaces", () => {
		expect(expandSpacingShorthand("calc(1rem + 2px) 4px")).toEqual({
			top: "calc(1rem + 2px)",
			right: "4px",
			bottom: "calc(1rem + 2px)",
			left: "4px",
		});
		expect(expandSpacingShorthand("var(--npb-space, 1rem)")).toEqual({
			top: "var(--npb-space, 1rem)",
			right: "var(--npb-space, 1rem)",
			bottom: "var(--npb-space, 1rem)",
			left: "var(--npb-space, 1rem)",
		});
	});
});

describe("spacingShorthand", () => {
	it("writes the shortest CSS form", () => {
		expect(spacingShorthand({ top: "1rem", right: "1rem", bottom: "1rem", left: "1rem" })).toBe("1rem");
		expect(spacingShorthand({ top: "20px", right: "24px", bottom: "20px", left: "24px" })).toBe("20px 24px");
		expect(spacingShorthand({ top: "10px", right: "24px", bottom: "30px", left: "24px" })).toBe("10px 24px 30px");
		expect(spacingShorthand({ top: "1px", right: "2px", bottom: "3px", left: "4px" })).toBe("1px 2px 3px 4px");
	});

	it.each(["1rem", "20px 24px", "36px 28px 28px", "1px 2px 3px 4px", "calc(1rem + 2px) 4px"])(
		"round-trips %s without changing it",
		(saved) => {
			expect(spacingShorthand(expandSpacingShorthand(saved))).toBe(saved);
		},
	);
});

describe("readSpacingSides", () => {
	it("lets a longhand win over the shorthand", () => {
		const sides = readSpacingSides({ styles: { padding: "1rem", paddingTop: "3rem" }, kind: "padding" });
		expect(sides).toEqual({ top: "3rem", right: "1rem", bottom: "1rem", left: "1rem" });
		expect(spacingSidesMatch(sides)).toBe(false);
	});

	it("reads a saved calc() shorthand with its sides in place", () => {
		expect(readSpacingSides({ styles: { margin: "calc(1rem + 2px) auto" }, kind: "margin" })).toEqual({
			top: "calc(1rem + 2px)",
			right: "auto",
			bottom: "calc(1rem + 2px)",
			left: "auto",
		});
	});
});

describe("buildSpacingStyles", () => {
	it("sets all four sides in one patch and clears the shorthand with null", () => {
		const next = buildSpacingStyles({
			resolved: { padding: "1rem" },
			previous: { padding: "1rem", color: "red" },
			patch: { paddingTop: "2rem", paddingRight: "2rem", paddingBottom: "2rem", paddingLeft: "2rem" },
		});
		expect(next).toMatchObject({
			paddingTop: "2rem",
			paddingRight: "2rem",
			paddingBottom: "2rem",
			paddingLeft: "2rem",
			padding: null,
			color: "red",
		});
	});

	it("keeps the other three sides when one side is edited under a shorthand", () => {
		const next = buildSpacingStyles({
			resolved: { padding: "1rem 2rem" },
			previous: { padding: "1rem 2rem" },
			patch: { paddingTop: "5rem" },
		});
		expect(next).toMatchObject({
			paddingTop: "5rem",
			paddingRight: "2rem",
			paddingBottom: "1rem",
			paddingLeft: "2rem",
			padding: null,
		});
	});

	it("does not overwrite a longhand that is already set", () => {
		const next = buildSpacingStyles({
			resolved: { padding: "1rem", paddingLeft: "9px" },
			previous: { padding: "1rem", paddingLeft: "9px" },
			patch: { paddingTop: "0" },
		});
		expect(next.paddingLeft).toBe("9px");
		expect(next.paddingTop).toBe("0");
	});

	it("clears sides with explicit null so a deep merge removes them", () => {
		const next = buildSpacingStyles({
			resolved: {},
			previous: { marginTop: "1rem" },
			patch: { marginTop: null },
		});
		expect(next.marginTop).toBeNull();
		expect(buildSpacingStyles({ resolved: {}, previous: { marginTop: "1rem" }, patch: { marginTop: "" } }).marginTop).toBeNull();
	});

	it("only touches the kind being edited", () => {
		const next = buildSpacingStyles({
			resolved: { padding: "1rem", margin: "2rem" },
			previous: { padding: "1rem", margin: "2rem" },
			patch: { marginTop: "0" },
		});
		expect(next.padding).toBe("1rem");
		expect(next.margin).toBeNull();
	});

	it("stores a negative margin as typed", () => {
		expect(buildSpacingStyles({ resolved: {}, previous: {}, patch: { marginTop: "-1rem" } }).marginTop).toBe("-1rem");
	});

	it("lists the four side keys for a kind", () => {
		expect(spacingSideKeys("margin")).toEqual(["marginTop", "marginRight", "marginBottom", "marginLeft"]);
	});
});

describe("applySpacingPatch", () => {
	it("returns the sides with the patch applied and cleared sides as empty", () => {
		const sides = { top: "1rem", right: "2rem", bottom: "1rem", left: "2rem" };
		expect(applySpacingPatch({ kind: "padding", sides, patch: { paddingRight: null, paddingLeft: "3rem" } })).toEqual({
			top: "1rem",
			right: "",
			bottom: "1rem",
			left: "3rem",
		});
	});

	it("ignores keys of the other kind", () => {
		const sides = { top: "1rem", right: "1rem", bottom: "1rem", left: "1rem" };
		expect(applySpacingPatch({ kind: "padding", sides, patch: { marginTop: "9rem" } })).toEqual(sides);
	});
});

describe("spacingPatchForAll", () => {
	it("gives one value to every side", () => {
		expect(spacingPatchForAll({ kind: "padding", value: "1rem" })).toEqual({
			paddingTop: "1rem",
			paddingRight: "1rem",
			paddingBottom: "1rem",
			paddingLeft: "1rem",
		});
	});

	it("splits a typed pair across the sides, as CSS reads it", () => {
		expect(spacingPatchForAll({ kind: "padding", value: "1rem 2rem" })).toEqual({
			paddingTop: "1rem",
			paddingRight: "2rem",
			paddingBottom: "1rem",
			paddingLeft: "2rem",
		});
	});

	it("keeps a calc() value whole on every side", () => {
		expect(spacingPatchForAll({ kind: "margin", value: "calc(1rem + 2px)" })).toEqual({
			marginTop: "calc(1rem + 2px)",
			marginRight: "calc(1rem + 2px)",
			marginBottom: "calc(1rem + 2px)",
			marginLeft: "calc(1rem + 2px)",
		});
	});

	it("clears every side when the value is empty", () => {
		expect(spacingPatchForAll({ kind: "margin", value: undefined })).toEqual({
			marginTop: null,
			marginRight: null,
			marginBottom: null,
			marginLeft: null,
		});
	});
});

describe("spacingPatchForPair", () => {
	it("sets both sides of the horizontal pair and nothing else", () => {
		expect(spacingPatchForPair({ kind: "padding", axis: "horizontal", value: "2rem" })).toEqual({
			paddingLeft: "2rem",
			paddingRight: "2rem",
		});
	});

	it("sets the two vertical sides separately when a pair is typed", () => {
		expect(spacingPatchForPair({ kind: "margin", axis: "vertical", value: "1rem 3rem" })).toEqual({
			marginTop: "1rem",
			marginBottom: "3rem",
		});
	});

	it("clears only its own pair", () => {
		expect(spacingPatchForPair({ kind: "padding", axis: "vertical", value: undefined })).toEqual({
			paddingTop: null,
			paddingBottom: null,
		});
	});
});

describe("spacingPairValue", () => {
	it("shows one value when the pair matches, and both when it does not", () => {
		expect(spacingPairValue("2rem", "2rem")).toBe("2rem");
		expect(spacingPairValue("1rem", "2rem")).toBe("1rem 2rem");
	});

	it("shows nothing when both sides are empty, and 0 for an empty side beside a set one", () => {
		expect(spacingPairValue("", "")).toBeUndefined();
		expect(spacingPairValue("1rem", "")).toBe("1rem 0");
	});
});

describe("applySpacingShorthandPatch (popup and accordion inner padding)", () => {
	it("edits one side and keeps the other three", () => {
		expect(
			applySpacingShorthandPatch({
				kind: "padding",
				current: "20px 24px",
				patch: { paddingTop: "10px" },
				fallback: "24px",
			}),
		).toBe("10px 24px 20px");
	});

	it("falls back to the block's default when every side is cleared", () => {
		expect(
			applySpacingShorthandPatch({
				kind: "padding",
				current: "20px 24px",
				patch: { paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null },
				fallback: "24px",
			}),
		).toBe("24px");
	});

	it("fills a side that was cleared from the default's matching side", () => {
		expect(
			applySpacingShorthandPatch({
				kind: "padding",
				current: "20px",
				patch: { paddingTop: null },
				fallback: "10px 24px",
			}),
		).toBe("10px 20px 20px");
	});

	it("uses the default when nothing is saved yet", () => {
		expect(applySpacingShorthandPatch({ kind: "padding", current: undefined, patch: {}, fallback: "20px 24px" })).toBe(
			"20px 24px",
		);
	});
});

describe("spacingPairsPatch (header and page shell keys)", () => {
	const sides = { top: "0.75rem", right: "1.25rem", bottom: "0.75rem", left: "1.25rem" };

	it("writes only the axis that was edited", () => {
		const result = spacingPairsPatch({
			sides,
			patch: { paddingLeft: "2rem", paddingRight: "2rem" },
		});
		expect(result).toEqual({ paddingInline: "2rem" });
		expect(result).not.toHaveProperty("paddingBlock");
	});

	it("reports a cleared axis as undefined so the save removes it", () => {
		const result = spacingPairsPatch({
			sides,
			patch: { paddingTop: null, paddingBottom: null },
		});
		expect(result).toHaveProperty("paddingBlock", undefined);
		expect(result).not.toHaveProperty("paddingInline");
	});

	it("keeps a typed pair as one saved value", () => {
		expect(
			spacingPairsPatch({ sides, patch: { paddingLeft: "1rem", paddingRight: "2rem" } }),
		).toEqual({ paddingInline: "1rem 2rem" });
	});
});

describe("pickSideMode", () => {
	it("opens on all sides when the sides match", () => {
		expect(pickSideMode({ sides: { top: "1rem", right: "1rem", bottom: "1rem", left: "1rem" }, allowed: ["all", "pairs", "each"] })).toBe("all");
	});

	it("opens in pairs when top and bottom match and left and right match", () => {
		expect(pickSideMode({ sides: { top: "2rem", right: "1rem", bottom: "2rem", left: "1rem" }, allowed: ["all", "pairs", "each"] })).toBe("pairs");
	});

	it("opens on each side when nothing pairs up, so no value is hidden", () => {
		expect(pickSideMode({ sides: { top: "1rem", right: "2rem", bottom: "3rem", left: "4rem" }, allowed: ["all", "pairs", "each"] })).toBe("each");
	});

	it("falls back to pairs, which shows any mix exactly, when each side is not offered", () => {
		expect(pickSideMode({ sides: { top: "1rem", right: "2rem", bottom: "3rem", left: "4rem" }, allowed: ["all", "pairs"] })).toBe("pairs");
	});

	it("uses the only mode a block offers", () => {
		expect(pickSideMode({ sides: { top: "1rem", right: "2rem", bottom: "3rem", left: "4rem" }, allowed: ["all"] })).toBe("all");
	});
});

describe("hasSpacingSide", () => {
	it("is true only when a side holds a value", () => {
		expect(hasSpacingSide(EMPTY)).toBe(false);
		expect(hasSpacingSide({ ...EMPTY, left: "0" })).toBe(true);
	});
});
