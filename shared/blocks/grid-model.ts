import type { BlockContent } from "../schema-types.js";
import { readChoice, readCount, readStructuredData, readText } from "./read-structured.js";

export const GRID_BLOCK_NAME = "core/grid";
/** The element inside the grid that holds the items (editor and published page alike). */
export const GRID_ITEMS_CLASS = "np-grid__items";

export const GRID_ALIGNS = ["stretch", "start", "center"] as const;
export type GridAlign = (typeof GRID_ALIGNS)[number];

/** How many columns and rows one item covers. An item with no entry covers a single cell. */
export type GridSpan = { columns: number; rows: number };

/** Widest and tallest an item can be. */
export const GRID_MAX_SPAN_COLUMNS = 4;
export const GRID_MAX_SPAN_ROWS = 3;
/** How many items, counting from the first, can have their own size. The CSS has one rule per position. */
export const GRID_MAX_SPANS = 24;

/**
 * Equal items N across, with their own counts for tablet (768–1023px) and phone (≤767px). With a
 * `minItemWidth` the grid fits as many items as there is room for instead, at every size.
 */
export type GridContent = {
	columns: number;
	tabletColumns: number;
	phoneColumns: number;
	/** A CSS length such as "240px"; empty uses the column counts. */
	minItemWidth: string;
	/** Items stretch to the tallest in the row, or sit at its top or middle. */
	align: GridAlign;
	/**
	 * Item sizes for bento layouts, by position: entry 0 sizes the first item, entry 1 the second.
	 * An empty list means every item covers one cell. Phones ignore it, and so does fit by width,
	 * where the number of columns changes with the width.
	 */
	spans: GridSpan[];
};

export const DEFAULT_GRID_CONTENT: GridContent = { columns: 3, tabletColumns: 2, phoneColumns: 1, minItemWidth: "", align: "stretch", spans: [] };

/** A saved size before it is checked: the numbers may be text, or missing. */
type SavedSpan = { columns?: number | string; rows?: number | string } | null;

/**
 * The saved item sizes, each kept inside the allowed range and the list cut to `GRID_MAX_SPANS`.
 * Saved content comes from people, imports and AI tools, so this never throws: anything that is
 * not a list reads as no sizes, and an entry that is not a size reads as one cell.
 */
export function readGridSpans(content: BlockContent | undefined): GridSpan[] {
	const saved = readStructuredData(content).spans;
	if (!Array.isArray(saved)) return [];
	return saved.slice(0, GRID_MAX_SPANS).map((entry: SavedSpan) => ({
		columns: readCount({ value: entry?.columns, min: 1, max: GRID_MAX_SPAN_COLUMNS, fallback: 1 }),
		rows: readCount({ value: entry?.rows, min: 1, max: GRID_MAX_SPAN_ROWS, fallback: 1 }),
	}));
}

export function readGridContent(content: BlockContent | undefined): GridContent {
	const data = readStructuredData(content);
	const columns = readCount({ value: data.columns, min: 1, max: 6, fallback: DEFAULT_GRID_CONTENT.columns });
	return {
		columns,
		tabletColumns: readCount({ value: data.tabletColumns, min: 1, max: 6, fallback: Math.min(columns, 2) }),
		phoneColumns: readCount({ value: data.phoneColumns, min: 1, max: 3, fallback: 1 }),
		minItemWidth: readText(data.minItemWidth).trim(),
		align: readChoice({ value: data.align, options: GRID_ALIGNS, fallback: "stretch" }),
		spans: readGridSpans(content),
	};
}

/** One item that is bigger than a single cell, as it is drawn on desktop and on tablet. */
export type GridItemSize = {
	/** Counting from 1, as the CSS counts children. */
	position: number;
	columns: number;
	rows: number;
	tabletColumns: number;
};

/**
 * The items that are bigger than a single cell on desktop or tablet. Column spans are cut down to
 * the columns each screen size has here, not in the CSS, so a 3-wide item in a 2-column tablet
 * grid is 2 wide. Fit by width gives none: its column count depends on the width, so a span
 * could ask for a column that is not there.
 */
export function listSizedItems(content: GridContent): GridItemSize[] {
	if (content.minItemWidth !== "") return [];
	return content.spans.flatMap((span, index) => {
		const columns = Math.min(span.columns, content.columns);
		const tabletColumns = Math.min(span.columns, content.tabletColumns);
		if (columns === 1 && span.rows === 1 && tabletColumns === 1) return [];
		return [{ position: index + 1, columns, rows: span.rows, tabletColumns }];
	});
}

type SpanVarKind = "c" | "r" | "t";

/** The CSS variable that holds one item's size: `c` columns, `r` rows, `t` columns on tablet. */
export function gridSpanVarName({ kind, position }: { kind: SpanVarKind; position: number }): string {
	return `--np-span-${kind}-${position}`;
}

/** The variables for the sized items only. Every other item reads 1 from the stylesheet. */
export function gridSpanVars(content: GridContent): Record<string, string> {
	const entries = listSizedItems(content).flatMap(({ position, columns, rows, tabletColumns }): [string, string][] => [
		[gridSpanVarName({ kind: "c", position }), String(columns)],
		[gridSpanVarName({ kind: "r", position }), String(rows)],
		[gridSpanVarName({ kind: "t", position }), String(tabletColumns)],
	]);
	return Object.fromEntries(entries);
}

/** Classes on the grid's outer element. `has-spans` turns on the item-size rules, so plain grids are untouched by them. */
export function gridClassNames(content: GridContent): string[] {
	return ["wp-block-grid", content.minItemWidth ? "has-min-width" : "", listSizedItems(content).length > 0 ? "has-spans" : ""].filter(Boolean);
}

/**
 * Inline CSS variables the shared grid CSS reads, so one stylesheet serves every grid. They sit on
 * the grid's outer element and reach the items by inheritance: on the editor canvas the items
 * element is drawn by the block tree, which has no way to take a style.
 */
export function gridStyleVars(content: GridContent): Record<string, string> {
	return {
		"--np-grid-cols": String(content.columns),
		"--np-grid-cols-tablet": String(content.tabletColumns),
		"--np-grid-cols-phone": String(content.phoneColumns),
		"--np-grid-align": content.align,
		...(content.minItemWidth ? { "--np-grid-min": content.minItemWidth } : {}),
		...gridSpanVars(content),
	};
}
