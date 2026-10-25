import type { ColumnLayout } from "./columns-layout.js";
import { parsePlainPercentWidth } from "./columns-flex-style.js";

/** A split of the row, as the percent each column gets. */
export type ColumnRatio = { label: string; widths: number[] };

/**
 * Ready-made splits by column count. They write the same per-column `width` the Width field
 * writes, so there is no second width setting to keep in step. Equal thirds use the 33.33 the
 * "3 columns" button already writes.
 */
export const COLUMN_RATIOS: Record<number, ColumnRatio[]> = {
	2: [
		{ label: "50/50", widths: [50, 50] },
		{ label: "60/40", widths: [60, 40] },
		{ label: "40/60", widths: [40, 60] },
		{ label: "67/33", widths: [66.67, 33.33] },
		{ label: "33/67", widths: [33.33, 66.67] },
		{ label: "75/25", widths: [75, 25] },
		{ label: "25/75", widths: [25, 75] },
	],
	3: [
		{ label: "33/33/33", widths: [33.33, 33.33, 33.33] },
		{ label: "50/25/25", widths: [50, 25, 25] },
		{ label: "25/50/25", widths: [25, 50, 25] },
		{ label: "25/25/50", widths: [25, 25, 50] },
	],
};

/** The ratios offered for this many columns; none for other counts. */
export const ratiosFor = (columnCount: number): ColumnRatio[] => COLUMN_RATIOS[columnCount] ?? [];

/** The layout with the ratio's widths written onto its columns. */
export function applyRatio({ layout, ratio }: { layout: ColumnLayout[]; ratio: ColumnRatio }): ColumnLayout[] {
	return layout.map((column, index) => ({ ...column, width: `${ratio.widths[index]}%` }));
}

const sameWidth = (width: string | undefined, percent: number): boolean => {
	const parsed = parsePlainPercentWidth(width ?? "");
	return parsed !== null && Math.abs(parsed - percent) < 0.01;
};

/** The ratio whose widths the columns have now, or null for custom widths (px, fr, auto, other percents). */
export function matchRatio(layout: ColumnLayout[]): ColumnRatio | null {
	return ratiosFor(layout.length).find((ratio) => ratio.widths.every((percent, index) => sameWidth(layout[index]?.width, percent))) ?? null;
}
