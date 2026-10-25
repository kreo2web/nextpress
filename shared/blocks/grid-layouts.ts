import { GRID_MAX_SPANS, GRID_MAX_SPAN_COLUMNS, type GridContent, type GridSpan } from "./grid-model.js";

export const GRID_LAYOUTS = ["equal", "featured", "wide-first", "alternating"] as const;
export type GridLayout = (typeof GRID_LAYOUTS)[number];

export const GRID_LAYOUT_LABELS: Record<GridLayout, string> = {
	equal: "Equal",
	featured: "Featured",
	"wide-first": "Wide first",
	alternating: "Alternating",
};

const ONE: GridSpan = { columns: 1, rows: 1 };
const isOne = (span: GridSpan): boolean => span.columns === 1 && span.rows === 1;

/** Item sizes without the 1×1 entries at the end, which mean the same as no entry. */
export function trimSpans(spans: GridSpan[]): GridSpan[] {
	const last = spans.findLastIndex((span) => !isOne(span));
	return spans.slice(0, last + 1);
}

/** The size of the item at `index`; items past the list are one cell. */
export const spanAt = ({ spans, index }: { spans: GridSpan[]; index: number }): GridSpan => spans[index] ?? ONE;

/** The list with one item's size changed, padded with 1×1 entries up to it and trimmed after. */
export function withSpanAt({ spans, index, span }: { spans: GridSpan[]; index: number; span: GridSpan }): GridSpan[] {
	const padded = Array.from({ length: Math.max(spans.length, index + 1) }, (_, at) => spanAt({ spans, index: at }));
	return trimSpans(padded.map((current, at) => (at === index ? span : current)));
}

/** Why a layout can't be used with these settings, or null when it can. Shown under the chips. */
export function explainLayoutBlocked({ layout, content }: { layout: GridLayout; content: GridContent }): string | null {
	if (content.minItemWidth !== "") return "Items are fitting by width, so sizes are off. Clear the width to use them.";
	if (layout === "featured" || layout === "wide-first") return content.columns < 2 ? "Needs 2 or more columns." : null;
	if (layout === "alternating") return content.columns === 3 ? null : "Needs 3 columns.";
	return null;
}

/** The sizes a layout gives `itemCount` items. Alternating repeats 2+1, 1+2 down the grid. */
export function buildLayoutSpans({ layout, itemCount }: { layout: GridLayout; itemCount: number }): GridSpan[] {
	const count = Math.min(itemCount, GRID_MAX_SPANS);
	const builders: Record<GridLayout, () => GridSpan[]> = {
		equal: () => [],
		featured: () => [{ columns: 2, rows: 2 }],
		"wide-first": () => [{ columns: 2, rows: 1 }],
		alternating: () => Array.from({ length: count }, (_, index) => ({ columns: [2, 1, 1, 2][index % 4], rows: 1 })),
	};
	return trimSpans(builders[layout]());
}

/** The layout whose sizes match what is saved, or null for a custom mix. */
export function matchLayout({ spans, itemCount }: { spans: GridSpan[]; itemCount: number }): GridLayout | null {
	const saved = JSON.stringify(trimSpans(spans));
	return GRID_LAYOUTS.find((layout) => JSON.stringify(buildLayoutSpans({ layout, itemCount })) === saved) ?? null;
}

export const GRID_SIZE_CHOICES = ["1x1", "2x1", "1x2", "2x2", "full"] as const;
export type GridSizeChoice = (typeof GRID_SIZE_CHOICES)[number];

export const GRID_SIZE_LABELS: Record<GridSizeChoice, string> = { "1x1": "1×1", "2x1": "2×1", "1x2": "1×2", "2x2": "2×2", full: "Full row" };

/** The size a chip writes. Full row covers every column, up to the widest an item can be. */
export function spanForChoice({ choice, columns }: { choice: GridSizeChoice; columns: number }): GridSpan {
	const sizes: Record<GridSizeChoice, GridSpan> = {
		"1x1": ONE,
		"2x1": { columns: 2, rows: 1 },
		"1x2": { columns: 1, rows: 2 },
		"2x2": { columns: 2, rows: 2 },
		full: { columns: Math.min(columns, GRID_MAX_SPAN_COLUMNS), rows: 1 },
	};
	return sizes[choice];
}

/** Which chip shows as chosen for a size. With 2 columns, 2×1 is already a full row, so it wins. */
export function choiceOf({ span, columns }: { span: GridSpan; columns: number }): GridSizeChoice | null {
	const found = GRID_SIZE_CHOICES.find((choice) => {
		const wanted = spanForChoice({ choice, columns });
		return wanted.columns === span.columns && wanted.rows === span.rows;
	});
	return found ?? null;
}

/** Why a size can't be chosen, or null when it can. */
export function explainChoiceBlocked({ choice, columns }: { choice: GridSizeChoice; columns: number }): string | null {
	if ((choice === "2x1" || choice === "2x2") && columns < 2) return "Needs 2 or more columns.";
	if (choice === "full" && columns < 3) return "Needs 3 or more columns.";
	if (choice === "full" && columns > GRID_MAX_SPAN_COLUMNS) return `Works up to ${GRID_MAX_SPAN_COLUMNS} columns.`;
	return null;
}
