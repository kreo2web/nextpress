/**
 * Callout block: its box only. The look of the callout itself (`.np-callout`) lives in
 * `markdown/markdown-css.ts`, shared with the MDX `<Callout>`; the block just fills the column and
 * lets the callout's own spacing sit inside the block's. Phone rules twice, as in tabs-css.ts.
 */
export const CALLOUT_CSS = `
.wp-block-callout { width: 100%; min-width: 0; }
.wp-block-callout > .np-callout { margin: 0; }
.wp-block-callout .np-callout-body > .np-visually-hidden + * { margin-top: 0; }

@media (max-width: 767px) {
  .wp-block-callout > .np-callout { padding: 0.75rem 0.875rem; gap: 0.625rem; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-callout > .np-callout { padding: 0.75rem 0.875rem; gap: 0.625rem; }
}
`;
