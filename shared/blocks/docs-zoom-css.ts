/**
 * Pictures in a docs page open larger (`/vendor/docs.js` adds `data-np-zoom` and the dialog).
 * Only opacity and a slight scale move, and not for readers who asked for less motion.
 */
export const DOCS_ZOOM_CSS = `
.np-docs__content img[data-np-zoom] { cursor: zoom-in; }
.np-docs__content img[data-np-zoom]:focus-visible { outline: 2px solid var(--npb-focus, var(--npb-accent, #2563eb)); outline-offset: 3px; }
.np-zoom { max-width: min(96vw, 1400px); max-height: 92vh; padding: 0; border: 0; border-radius: 10px; background: transparent; overflow: visible; }
.np-zoom::backdrop { background: rgba(9, 9, 11, 0.82); }
.np-zoom img { display: block; max-width: min(96vw, 1400px); max-height: 88vh; width: auto; height: auto; border-radius: 10px; cursor: zoom-out; }
.np-zoom__close { position: absolute; top: -2.75rem; right: 0; min-height: 2.25rem; padding: 0.35rem 0.85rem; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 0.5rem; background: rgba(9, 9, 11, 0.6); color: #fafafa; font: 500 0.85rem/1.2 system-ui, sans-serif; cursor: pointer; }
.np-zoom__close:focus-visible { outline: 2px solid #fafafa; outline-offset: 2px; }
@keyframes np-zoom-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: no-preference) { .np-zoom[open] { animation: np-zoom-in 0.16s ease-out; } }
`;
