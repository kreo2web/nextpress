/**
 * Look of Tabs, for the published page and the editor canvas alike (same classes, one sheet).
 * Only colour and shadow change between the selected and other tabs, so nothing moves.
 */
export const TABS_CSS = `
.wp-block-tabs { width: 100%; min-width: 0; }
.wp-block-tabs .np-tabs__list {
  display: flex;
  gap: 0.25rem;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}
.wp-block-tabs .np-tabs__tab {
  flex: none;
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--npb-text-secondary, #64748b);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  line-height: 1.3;
  padding: 0.65rem 1rem;
  white-space: nowrap;
}
.wp-block-tabs .np-tabs__tab:hover { color: var(--npb-text-primary, #0f172a); }
.wp-block-tabs .np-tabs__tab[aria-selected="true"] { color: var(--npb-accent, #2563eb); }
.wp-block-tabs .np-tabs__tab:focus-visible {
  outline: 2px solid var(--npb-focus, #3b82f6);
  outline-offset: -2px;
}

.wp-block-tabs.np-tabs--underline .np-tabs__list { border-bottom: 1px solid var(--npb-border-default, #e2e8f0); }
.wp-block-tabs.np-tabs--underline .np-tabs__tab {
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.wp-block-tabs.np-tabs--underline .np-tabs__tab[aria-selected="true"] { border-bottom-color: var(--npb-accent, #2563eb); }

.wp-block-tabs.np-tabs--pills .np-tabs__tab { border-radius: 999px; padding: 0.5rem 1rem; }
.wp-block-tabs.np-tabs--pills .np-tabs__tab[aria-selected="true"] {
  background: color-mix(in srgb, var(--npb-accent, #2563eb) 14%, transparent);
}

.wp-block-tabs.np-tabs--segmented .np-tabs__list {
  background: var(--npb-surface-muted, #f1f5f9);
  border-radius: 10px;
  display: inline-flex;
  gap: 2px;
  padding: 4px;
}
.wp-block-tabs.np-tabs--segmented .np-tabs__tab { border-radius: 7px; padding: 0.45rem 0.9rem; }
.wp-block-tabs.np-tabs--segmented .np-tabs__tab[aria-selected="true"] {
  background: var(--npb-surface-raised, #fff);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
}

.wp-block-tabs .np-tabs__panels { padding-top: 1.25rem; min-width: 0; }
.wp-block-tab:not([hidden]) { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
.wp-block-tab[hidden] { display: none !important; }
.wp-block-tab:focus-visible {
  outline: 2px solid var(--npb-focus, #3b82f6);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .wp-block-tabs .np-tabs__tab { padding: 0.6rem 0.85rem; }
  .wp-block-tabs .np-tabs__panels { padding-top: 1rem; }
  .wp-block-tabs.np-tabs--segmented .np-tabs__list { display: flex; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-tabs .np-tabs__tab { padding: 0.6rem 0.85rem; }
  .npb-canvas-page .wp-block-tabs .np-tabs__panels { padding-top: 1rem; }
  .npb-canvas-page .wp-block-tabs.np-tabs--segmented .np-tabs__list { display: flex; }
}
`;
