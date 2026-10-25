/**
 * Parameters: each `.np-param` is a bordered row. Neighbouring rows share their border and only the
 * first and last are rounded, so consecutive MDX `<Param>` tags read as one list with no wrapper.
 * Phone rules twice, as in tabs-css.ts.
 */
export const PARAMS_CSS = `
.wp-block-params { width: 100%; min-width: 0; }
.np-param {
  margin: 1.25em 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--npb-border-default, #e2e8f0);
  border-radius: 8px;
  color: var(--npb-text-primary, #0f172a);
}
.np-param + .np-param,
.np-params > .np-param + .np-param { margin-top: -1px; border-top-left-radius: 0; border-top-right-radius: 0; }
.np-param:has(+ .np-param) { margin-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.np-params { margin: 1.25em 0; }
.wp-block-params > .np-params { margin: 0; }
.np-params > .np-param { margin: 0; }
.np-params > .np-param + .np-param { margin-top: -1px; }
.np-param-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
.np-param-name { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9375rem; font-weight: 600; }
.np-param-type { color: var(--npb-text-secondary, #64748b); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.8125rem; }
.np-param-flag {
  padding: 0.1em 0.55em;
  border-radius: 999px;
  background: color-mix(in srgb, #dc2626 12%, transparent);
  color: #b91c1c;
  font-size: 0.75rem;
  font-weight: 600;
}
.np-param-default { color: var(--npb-text-secondary, #64748b); font-size: 0.8125rem; }
.np-param-body { margin-top: 0.4rem; font-size: 0.875rem; line-height: 1.6; color: var(--npb-text-secondary, #475569); }
.np-param-body :where(p, ul, ol) { margin: 0.5em 0; }
.np-param-body > :first-child,
.np-param-body > .np-prose > :first-child { margin-top: 0; }
.np-param-body > :last-child,
.np-param-body > .np-prose > :last-child { margin-bottom: 0; }

@media (max-width: 767px) {
  .np-param { padding: 0.65rem 0.8rem; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .np-param { padding: 0.65rem 0.8rem; }
}
`;
