/**
 * Code example: a "Code" pane and a "Result" pane in one bordered box. Two columns from 768px when
 * the layout is "side", stacked otherwise and always on phones. The editor canvas keeps the blocks
 * in one stack (so each stays editable) and marks the first as the code and the next as the result.
 * Phone rules twice, as in tabs-css.ts.
 */
export const CODE_EXAMPLE_CSS = `
.wp-block-code-example { width: 100%; min-width: 0; }
.np-example {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 1.25em 0;
  overflow: hidden;
  border: 1px solid var(--npb-border-default, #e2e8f0);
  border-radius: 8px;
}
.wp-block-code-example > .np-example { margin: 0; }
.np-example-pane { min-width: 0; padding: 0.75rem 1rem 1rem; }
.np-example-pane + .np-example-pane { border-top: 1px solid var(--npb-border-default, #e2e8f0); }
.np-example-label,
.np-example--canvas .np-example-stack > :first-child::before,
.np-example--canvas .np-example-stack > :nth-child(2)::before {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--npb-text-secondary, #64748b);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.np-example--canvas .np-example-stack { padding: 0.75rem 1rem 1rem; }
.np-example--canvas .np-example-stack > :first-child::before { content: "Code"; }
.np-example--canvas .np-example-stack > :nth-child(2)::before { content: "Result"; margin-top: 0.75rem; }
.np-example-pane > .np-code,
.np-example-pane > pre { margin: 0; }
.np-example-result > :nth-child(2) { margin-top: 0; }

@media (min-width: 768px) {
  .np-example[data-layout="side"]:not(.np-example--canvas) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .np-example[data-layout="side"] .np-example-pane + .np-example-pane { border-top: 0; border-left: 1px solid var(--npb-border-default, #e2e8f0); }
}
@media (max-width: 767px) {
  .np-example-pane { padding: 0.65rem 0.8rem 0.8rem; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .np-example-pane { padding: 0.65rem 0.8rem 0.8rem; }
}
`;
