/** Published and editor CSS for the Card block. Only transform and opacity move, and not under reduced motion. */
export const CARD_CSS = `
.wp-block-card { position: relative; box-sizing: border-box; min-width: 0; }
.wp-block-card .np-card__body { display: flex; flex-direction: column; gap: inherit; min-width: 0; }
.wp-block-card.np-card--bordered { border: 1px solid var(--npb-border-default, #e2e8f0); background: var(--npb-surface-base, #fff); }
.wp-block-card.np-card--raised { background: var(--npb-surface-raised, #fff); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 14px rgba(15, 23, 42, 0.08); }
.wp-block-card.np-card--subtle { background: color-mix(in srgb, currentColor 4%, transparent); }
.wp-block-card.np-card--plain { background: none; }
.wp-block-card.is-linked { transition: transform 160ms var(--npb-ease-out, cubic-bezier(0.23, 1, 0.32, 1)), box-shadow 160ms var(--npb-ease-out, cubic-bezier(0.23, 1, 0.32, 1)); }
.wp-block-card.is-linked:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08), 0 10px 28px rgba(15, 23, 42, 0.14); }
.wp-block-card .np-card__link { position: absolute; inset: 0; z-index: 1; border-radius: inherit; }
.wp-block-card .np-card__link:focus-visible { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: 2px; }
.wp-block-card .np-card__body a,
.wp-block-card .np-card__body button { position: relative; z-index: 2; }
.wp-block-card .np-card__link-note { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--npb-text-muted, #64748b); overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
  .wp-block-card.is-linked { transition: none; }
  .wp-block-card.is-linked:hover { transform: none; }
}
`.trim();
