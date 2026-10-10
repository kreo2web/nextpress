import { splitCssValueList } from "@shared/page-shell-padding";

export type SpacingSideQuad = {
	top: string;
	right: string;
	bottom: string;
	left: string;
};

export type SpacingKind = "padding" | "margin";
export type SpacingSide = keyof SpacingSideQuad;
export type SpacingSideKey = `${SpacingKind}${"Top" | "Right" | "Bottom" | "Left"}`;
/** The horizontal pair is left and right; the vertical pair is top and bottom. */
export type SpacingAxis = "horizontal" | "vertical";
/** Writes to one or more sides: a value sets the side, `null` clears it. */
export type SpacingPatch = Partial<Record<SpacingSideKey, string | null>>;
/** The ways a block sets its sides: one value for all four, two pairs, or each side on its own. */
export type SpacingSideMode = "all" | "pairs" | "each";

const SIDES: readonly SpacingSide[] = ["top", "right", "bottom", "left"];
const EMPTY_QUAD: SpacingSideQuad = { top: "", right: "", bottom: "", left: "" };

/** The storage key for one side of one kind, e.g. `sideKey("margin", "left")` gives `marginLeft`. */
export function sideKey(kind: SpacingKind, side: SpacingSide): SpacingSideKey {
	return `${kind}${side.charAt(0).toUpperCase()}${side.slice(1)}` as SpacingSideKey;
}

/** All four side keys for one kind, in CSS order (top, right, bottom, left). */
export function spacingSideKeys(kind: SpacingKind): SpacingSideKey[] {
	return SIDES.map((side) => sideKey(kind, side));
}

/**
 * Expands a CSS box shorthand (1 to 4 values) into four sides.
 *
 * WHY: values are split with `splitCssValueList`, so `calc(1rem + 2px)` and `var(--x, 1rem)` stay whole.
 * A plain space split would tear them apart and show the wrong sides.
 */
export function expandSpacingShorthand(raw: unknown): SpacingSideQuad {
	if (raw == null || raw === "") return { ...EMPTY_QUAD };
	const values = splitCssValueList(String(raw));
	const [top = "", right = top, bottom = top, left = right] = values;
	return { top, right, bottom, left };
}

/**
 * WHY: Longhands win over shorthand in the UI when both appear after merges (accessor vs tree styles).
 */
function overlaySpacingLonghands({
	styles,
	expanded,
	kind,
}: {
	styles: Record<string, unknown>;
	expanded: SpacingSideQuad;
	kind: SpacingKind;
}): SpacingSideQuad {
	const pick = (side: SpacingSide): string => {
		const value = styles[sideKey(kind, side)];
		if (value != null && String(value).trim() !== "") return String(value);
		return expanded[side];
	};
	return { top: pick("top"), right: pick("right"), bottom: pick("bottom"), left: pick("left") };
}

/** Current four sides for padding or margin, longhands over shorthand. */
export function readSpacingSides({
	styles,
	kind,
}: {
	styles: Record<string, unknown>;
	kind: SpacingKind;
}): SpacingSideQuad {
	return overlaySpacingLonghands({
		styles,
		expanded: expandSpacingShorthand(styles[kind]),
		kind,
	});
}

/** True when all four sides hold the same value (so one linked field can show it). */
export function spacingSidesMatch(sides: SpacingSideQuad): boolean {
	return sides.top === sides.right && sides.top === sides.bottom && sides.top === sides.left;
}

/** True when at least one side holds a value. */
export function hasSpacingSide(sides: SpacingSideQuad): boolean {
	return SIDES.some((side) => sides[side] !== "");
}

/**
 * Picks how the control opens: the simplest mode that shows every side exactly, so a mixed value is
 * never hidden. Falls back to the next mode the block allows.
 */
export function pickSideMode({
	sides,
	allowed,
}: {
	sides: SpacingSideQuad;
	allowed: readonly SpacingSideMode[];
}): SpacingSideMode {
	const preferred: SpacingSideMode = spacingSidesMatch(sides)
		? "all"
		: sides.top === sides.bottom && sides.left === sides.right
			? "pairs"
			: "each";
	// "all" cannot show a mixed value, so a mixed one never falls back to it while another mode exists.
	const order: Record<SpacingSideMode, readonly SpacingSideMode[]> = {
		all: ["all", "pairs", "each"],
		pairs: ["pairs", "each", "all"],
		each: ["each", "pairs", "all"],
	};
	return order[preferred].find((mode) => allowed.includes(mode)) ?? allowed[0] ?? "all";
}

const kindOfKey = (key: string): SpacingKind => (key.startsWith("padding") ? "padding" : "margin");

/**
 * Builds the next `styles` object for a spacing edit.
 *
 * WHY: `updateBlockDeep` deep-merges `styles`, so an omitted key keeps its old value. Clearing needs an
 * explicit `null`. When a shorthand (`padding: 1rem 2rem`) exists, it is turned into longhands first, so
 * editing one side does not silently wipe the other three.
 */
export function buildSpacingStyles({
	resolved,
	previous,
	patch,
}: {
	/** Block styles merged with the live in-memory styles — where shorthands may hide. */
	resolved: Record<string, unknown>;
	/** The object the edit is applied on top of. */
	previous: Record<string, unknown>;
	patch: SpacingPatch;
}): Record<string, unknown> {
	const next: Record<string, unknown> = { ...previous };
	const kinds = new Set<SpacingKind>(Object.keys(patch).map(kindOfKey));

	kinds.forEach((kind) => {
		if (resolved[kind] == null) return;
		const expanded = expandSpacingShorthand(resolved[kind]);
		SIDES.forEach((side) => {
			const key = sideKey(kind, side);
			const alreadySet = next[key] != null && String(next[key]).trim() !== "";
			if (!alreadySet && expanded[side]) next[key] = expanded[side];
		});
		next[kind] = null;
	});

	Object.entries(patch).forEach(([key, value]) => {
		next[key] = value == null || value === "" ? null : value;
	});
	return next;
}

/** The four sides after a patch is applied. A cleared side comes back as an empty string. */
export function applySpacingPatch({
	kind,
	sides,
	patch,
}: {
	kind: SpacingKind;
	sides: SpacingSideQuad;
	patch: SpacingPatch;
}): SpacingSideQuad {
	const next = { ...sides };
	SIDES.forEach((side) => {
		const key = sideKey(kind, side);
		if (key in patch) next[side] = patch[key] ?? "";
	});
	return next;
}

/** A patch for the same value on every side. A shorthand typed here (`1rem 2rem`) is split across the sides. */
export function spacingPatchForAll({
	kind,
	value,
}: {
	kind: SpacingKind;
	value: string | undefined;
}): SpacingPatch {
	const text = value?.trim() ?? "";
	if (text === "") return patchFromQuad(kind, EMPTY_QUAD);
	// Five or more values is not valid CSS. Keep what was typed on every side rather than dropping values.
	if (splitCssValueList(text).length > 4) {
		return patchFromQuad(kind, { top: text, right: text, bottom: text, left: text });
	}
	return patchFromQuad(kind, expandSpacingShorthand(text));
}

/**
 * A patch for one axis: `left and right` or `top and bottom`. A pair typed as `1rem 2rem` sets the two
 * sides separately, so each side always holds one plain value.
 */
export function spacingPatchForPair({
	kind,
	axis,
	value,
}: {
	kind: SpacingKind;
	axis: SpacingAxis;
	value: string | undefined;
}): SpacingPatch {
	const [first, second] = axis === "horizontal" ? (["left", "right"] as const) : (["top", "bottom"] as const);
	const text = value?.trim() ?? "";
	if (text === "") {
		return { [sideKey(kind, first)]: null, [sideKey(kind, second)]: null };
	}
	const parts = splitCssValueList(text);
	const [a, b] = parts.length === 2 ? [parts[0] ?? text, parts[1] ?? text] : [text, text];
	return { [sideKey(kind, first)]: a, [sideKey(kind, second)]: b };
}

function patchFromQuad(kind: SpacingKind, quad: SpacingSideQuad): SpacingPatch {
	const patch: SpacingPatch = {};
	SIDES.forEach((side) => {
		patch[sideKey(kind, side)] = quad[side] === "" ? null : quad[side];
	});
	return patch;
}

/** The value one axis shows and saves: one value when both sides match, else the two as `first second`. */
export function spacingPairValue(first: string, second: string): string | undefined {
	if (first === "" && second === "") return undefined;
	if (first === second) return first;
	return `${first || "0"} ${second || "0"}`;
}

/**
 * The shortest CSS shorthand for four sides: `a`, `a b`, `a b c`, or `a b c d`.
 * Callers fill any empty side first, because a shorthand cannot hold a gap.
 */
export function spacingShorthand(sides: SpacingSideQuad): string {
	const { top, right, bottom, left } = sides;
	if (top === right && top === bottom && top === left) return top;
	if (top === bottom && right === left) return `${top} ${right}`;
	if (right === left) return `${top} ${right} ${bottom}`;
	return `${top} ${right} ${bottom} ${left}`;
}

/**
 * Applies an edit to a single saved shorthand (a popup's or an accordion's inner padding), and returns the
 * new shorthand. A side the edit cleared falls back to the matching side of `fallback`, the block's default.
 */
export function applySpacingShorthandPatch({
	kind,
	current,
	patch,
	fallback,
}: {
	kind: SpacingKind;
	current: unknown;
	patch: SpacingPatch;
	fallback: string;
}): string {
	const edited = applySpacingPatch({ kind, sides: expandSpacingShorthand(current), patch });
	const defaults = expandSpacingShorthand(fallback);
	const filled: SpacingSideQuad = {
		top: edited.top || defaults.top || "0",
		right: edited.right || defaults.right || "0",
		bottom: edited.bottom || defaults.bottom || "0",
		left: edited.left || defaults.left || "0",
	};
	return spacingShorthand(filled);
}

/**
 * Header and page shell keep their padding in two keys, `paddingInline` (left and right) and `paddingBlock`
 * (top and bottom). Returns only the keys this edit touched, so editing one axis never writes the other.
 */
export function spacingPairsPatch({
	sides,
	patch,
}: {
	sides: SpacingSideQuad;
	patch: SpacingPatch;
}): { paddingInline?: string; paddingBlock?: string } {
	const edited = applySpacingPatch({ kind: "padding", sides, patch });
	const touches = (...sidesOnAxis: SpacingSide[]) =>
		sidesOnAxis.some((side) => sideKey("padding", side) in patch);
	const result: { paddingInline?: string; paddingBlock?: string } = {};
	if (touches("left", "right")) result.paddingInline = spacingPairValue(edited.left, edited.right);
	if (touches("top", "bottom")) result.paddingBlock = spacingPairValue(edited.top, edited.bottom);
	return result;
}
