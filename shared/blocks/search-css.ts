/**
 * Search: the button on the page and the window `/vendor/search.js` opens. Colours come from the
 * page's --npb-* tokens with fallbacks; only transform and opacity move, and not under reduced motion.
 */
export const SEARCH_CSS = `
.wp-block-search { display: block; }
.np-search {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 100%;
  min-height: 2.5rem;
  padding: 0.45rem 0.7rem 0.45rem 0.85rem;
  border: 1px solid var(--npb-border-default, #d4d4d8);
  border-radius: 0.6rem;
  background: var(--npb-surface-raised, #ffffff);
  color: var(--npb-text-secondary, #52525b);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.np-search:hover { border-color: var(--npb-accent, #3b82f6); color: var(--npb-text-primary, #18181b); }
.np-search:focus-visible { outline: 2px solid var(--npb-focus, var(--npb-accent, #3b82f6)); outline-offset: 2px; }
.np-search__icon { flex: none; }
.np-search__label { flex: 1 1 auto; text-align: left; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.np-search__kbd {
  flex: none;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--npb-border-default, #d4d4d8);
  border-radius: 0.35rem;
  background: var(--npb-surface-muted, #f4f4f5);
  color: var(--npb-text-muted, #71717a);
  font: inherit;
  font-size: 0.72rem;
  line-height: 1.4;
}
@media (max-width: 767px) { .np-search__kbd { display: none; } }
@container npb-canvas (max-width: 767px) { .npb-canvas-page .np-search__kbd { display: none; } }

.np-search-dialog {
  width: min(40rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100vh - 6rem));
  margin: 8vh auto auto;
  padding: 0;
  border: 1px solid var(--npb-border-default, #d4d4d8);
  border-radius: 0.9rem;
  background: var(--npb-surface-raised, #ffffff);
  color: var(--npb-text-primary, #18181b);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.np-search-dialog[open] { display: flex; flex-direction: column; animation: np-search-in 0.16s var(--npb-ease-out, ease-out); }
.np-search-dialog::backdrop { background: rgba(9, 9, 11, 0.5); }
html:has(.np-search-dialog[open]) { overflow: hidden; }
.np-search-dialog__bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--npb-border-default, #e4e4e7);
  color: var(--npb-text-muted, #71717a);
}
.np-search-dialog__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--npb-text-primary, #18181b);
  font: inherit;
  font-size: 1rem;
  outline: none;
}
/* The Esc button already closes; the browser's own clear cross would be a second, different one. */
.np-search-dialog__input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.np-search-dialog__close {
  flex: none;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--npb-border-default, #d4d4d8);
  border-radius: 0.35rem;
  background: var(--npb-surface-muted, #f4f4f5);
  color: var(--npb-text-muted, #71717a);
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}
.np-search-dialog__close:focus-visible { outline: 2px solid var(--npb-focus, var(--npb-accent, #3b82f6)); outline-offset: 2px; }
.np-search-dialog__results { list-style: none; margin: 0; padding: 0.4rem; overflow-y: auto; }
.np-search-dialog__results:empty { display: none; }
.np-search-dialog__result {
  display: block;
  padding: 0.6rem 0.75rem;
  border-radius: 0.55rem;
  color: inherit;
  text-decoration: none;
}
.np-search-dialog__result[aria-selected="true"], .np-search-dialog__result:hover {
  background: color-mix(in srgb, var(--npb-accent, #3b82f6) 12%, transparent);
}
.np-search-dialog__title { display: block; font-weight: 600; }
.np-search-dialog__snippet { display: block; margin-top: 0.15rem; font-size: 0.85rem; color: var(--npb-text-secondary, #52525b); }
.np-search-dialog__status { margin: 0; padding: 1.25rem 1rem; text-align: center; font-size: 0.9rem; color: var(--npb-text-muted, #71717a); }
.np-search-dialog__status:empty { display: none; }
@keyframes np-search-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .np-search, .np-search-dialog[open] { transition: none; animation: none; }
}
`;
