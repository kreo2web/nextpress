/**
 * "Reverse order on phones": when the columns stack, the last column goes on top. Tablets keep the
 * normal order, so this only applies at phone width (≤767px). The two-class selector beats the
 * stacking rule in publish-block-css.ts, which is why this file doesn't edit that one.
 */
export const COLUMNS_EXTRAS_CSS = `
@media (max-width: 767px) {
  .wp-block-columns.is-reversed-on-phones {
    flex-direction: column-reverse !important;
  }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-columns.is-reversed-on-phones {
    flex-direction: column-reverse !important;
  }
}
`;
