/** Rules shared by the published page and the editor canvas. `!important` on display beats the canvas's inline flex stack. */
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

/** Published and editor CSS for the Grid block. Phone is 767px and under, tablet 768 to 1023px. */
export const GRID_CSS = `${GRID_BASE}
@media (min-width: 768px) and (max-width: 1023px) {
  .wp-block-grid .np-grid__items { ${TABLET} }
}
@media (max-width: 767px) {
  .wp-block-grid .np-grid__items { ${PHONE} }
}
@container npb-canvas (min-width: 768px) and (max-width: 1023px) {
  .npb-canvas-page .wp-block-grid .np-grid__items { ${TABLET} }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-grid .np-grid__items { ${PHONE} }
}
${FIT}
`.trim();
