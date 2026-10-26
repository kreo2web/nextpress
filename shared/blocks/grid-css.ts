import { GRID_MAX_SPANS, gridSpanVarName } from "./grid-model.js";

/** Rules shared by the published page and the editor canvas. The canvas puts no layout of its own on the items list, so these rules lay it out in both. */
const GRID_BASE = `
.wp-block-grid { width: 100%; min-width: 0; }
.wp-block-grid .np-grid__items {
  display: grid !important;
  grid-template-columns: repeat(var(--np-grid-cols, 3), minmax(0, 1fr));
  align-items: var(--np-grid-align, stretch);
  gap: inherit;
  width: 100%;
  min-width: 0;
}
.wp-block-grid .np-grid__items > * { min-width: 0; }
`;

const TABLET = `grid-template-columns: repeat(var(--np-grid-cols-tablet, 2), minmax(0, 1fr));`;
const PHONE = `grid-template-columns: repeat(var(--np-grid-cols-phone, 1), minmax(0, 1fr));`;
/** Fit by width wins at every size. The doubled class lifts it over the column-count rules above. */
const FIT = `.wp-block-grid.has-min-width .np-grid__items.np-grid__items { grid-template-columns: repeat(auto-fit, minmax(min(var(--np-grid-min, 240px), 100%), 1fr)); }`;

/*
 * Item sizes (bento layouts). The model writes `--np-span-c-<n>` (columns), `--np-span-r-<n>` (rows)
 * and `--np-span-t-<n>` (columns on tablet, already cut down to the tablet's column count) for
 * each sized item, and there is one rule per position that reads them. Only grids with `has-spans`
 * get the rules; the child combinators keep a plain grid inside a sized item out of them.
 */
const POSITIONS = Array.from({ length: GRID_MAX_SPANS }, (_, index) => index + 1);
const eachPosition = (rule: (position: number) => string): string => POSITIONS.map(rule).join("\n");
const readVar = ({ kind, position }: { kind: "c" | "r" | "t"; position: number }): string => `var(${gridSpanVarName({ kind, position })})`;

const PAGE_ITEMS = ".wp-block-grid.has-spans > .np-grid__items";
const CANVAS_ITEMS = `.npb-canvas-page ${PAGE_ITEMS}`;
/** On the page the n-th child is the n-th item. */
const pageItem = (position: number): string => `${PAGE_ITEMS} > :nth-child(${position})`;
/**
 * The canvas shows a drop bar (`aria-hidden`) between the items while one is dragged. Counting
 * only the other children keeps every item at its own size during the drag.
 */
const canvasItem = (position: number): string => `${CANVAS_ITEMS} > :nth-child(${position} of :not([aria-hidden="true"]))`;

/** Every position reads 1 until a grid says otherwise. Set on the grid itself, so a grid inside a sized item doesn't inherit the outer grid's sizes. */
const SPAN_DEFAULTS = `.wp-block-grid.has-spans {
${eachPosition((position) => `  ${(["c", "r", "t"] as const).map((kind) => `${gridSpanVarName({ kind, position })}: 1;`).join(" ")}`)}
}`;

const sizeOf = (position: number): string => `grid-column: span ${readVar({ kind: "c", position })}; grid-row: span ${readVar({ kind: "r", position })};`;
const tabletSizeOf = (position: number): string => `grid-column: span ${readVar({ kind: "t", position })};`;
/** A phone shows every item as one cell. `!important` beats the position rules whatever their weight. */
const phoneSizes = (items: string): string =>
	`  ${items} { grid-auto-flow: row; }\n  ${items} > * { grid-column: auto !important; grid-row: auto !important; }`;

const SPAN_BASE = `
${SPAN_DEFAULTS}
${PAGE_ITEMS} { grid-auto-flow: row dense; }
${eachPosition((position) => `${pageItem(position)} { ${sizeOf(position)} }`)}
${eachPosition((position) => `${canvasItem(position)} { ${sizeOf(position)} }`)}
${CANVAS_ITEMS} > [aria-hidden="true"] { grid-column: auto; grid-row: auto; }
`;

/**
 * Canvas only: the editor wraps each item in boxes of its own (drag, outline, toolbar), between the
 * cell and the item's block. Each box on that path passes the cell's height down, so a stretched item
 * fills its cell as it does on the page. Boxes inside the item's block, and the toolbar beside the
 * path, are left alone.
 */
const CANVAS_ITEM = ".npb-canvas-page .wp-block-grid .np-grid__items > [data-rfd-draggable-id]";
/** "Inside the item" is counted from the cell down: the Grid itself sits in a block box of its own. */
const CANVAS_ITEM_BLOCK = `${CANVAS_ITEM} [data-block-id]:not(${CANVAS_ITEM} [data-block-id] [data-block-id])`;
const CANVAS_FILL = `
${CANVAS_ITEM} div:has([data-block-id]):not(${CANVAS_ITEM} [data-block-id] div),
${CANVAS_ITEM_BLOCK},
${CANVAS_ITEM_BLOCK} > div,
${CANVAS_ITEM_BLOCK} > div > * { height: 100%; }
`;

/** Published and editor CSS for the Grid block. Phone is 767px and under, tablet 768 to 1023px. */
export const GRID_CSS = `${GRID_BASE}${SPAN_BASE}${CANVAS_FILL}
@media (min-width: 768px) and (max-width: 1023px) {
  .wp-block-grid .np-grid__items { ${TABLET} }
${eachPosition((position) => `  ${pageItem(position)} { ${tabletSizeOf(position)} }`)}
}
@media (max-width: 767px) {
  .wp-block-grid .np-grid__items { ${PHONE} }
${phoneSizes(PAGE_ITEMS)}
}
@container npb-canvas (min-width: 768px) and (max-width: 1023px) {
  .npb-canvas-page .wp-block-grid .np-grid__items { ${TABLET} }
${eachPosition((position) => `  ${canvasItem(position)} { ${tabletSizeOf(position)} }`)}
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-grid .np-grid__items { ${PHONE} }
${phoneSizes(CANVAS_ITEMS)}
}
${FIT}
`.trim();
