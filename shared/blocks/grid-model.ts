import type { BlockContent } from "../schema-types.js";
import { readChoice, readCount, readStructuredData, readText } from "./read-structured.js";

export const GRID_BLOCK_NAME = "core/grid";
/** The element inside the grid that holds the items (editor and published page alike). */
export const GRID_ITEMS_CLASS = "np-grid__items";

export const GRID_ALIGNS = ["stretch", "start", "center"] as const;
export type GridAlign = (typeof GRID_ALIGNS)[number];

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
};

export const DEFAULT_GRID_CONTENT: GridContent = { columns: 3, tabletColumns: 2, phoneColumns: 1, minItemWidth: "", align: "stretch" };

export function readGridContent(content: BlockContent | undefined): GridContent {
	const data = readStructuredData(content);
	const columns = readCount({ value: data.columns, min: 1, max: 6, fallback: DEFAULT_GRID_CONTENT.columns });
	return {
		columns,
		tabletColumns: readCount({ value: data.tabletColumns, min: 1, max: 6, fallback: Math.min(columns, 2) }),
		phoneColumns: readCount({ value: data.phoneColumns, min: 1, max: 3, fallback: 1 }),
		minItemWidth: readText(data.minItemWidth).trim(),
		align: readChoice({ value: data.align, options: GRID_ALIGNS, fallback: "stretch" }),
	};
}

/** Inline CSS variables the shared grid CSS reads, so one stylesheet serves every grid. */
export function gridStyleVars(content: GridContent): Record<string, string> {
	return {
		"--np-grid-cols": String(content.columns),
		"--np-grid-cols-tablet": String(content.tabletColumns),
		"--np-grid-cols-phone": String(content.phoneColumns),
		"--np-grid-align": content.align,
		...(content.minItemWidth ? { "--np-grid-min": content.minItemWidth } : {}),
	};
}
