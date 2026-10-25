/**
 * Changelog entries: the label column beside the entry's content, stacked on phones. Shared by the
 * published page and the editor's device preview. The rules are scoped under `.np-update` so the
 * prose styles of a surrounding `.np-prose` cannot override the label.
 */
export const UPDATE_CSS = `
.np-update { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); column-gap: 2.5rem; align-items: start; box-sizing: border-box; width: 100%; margin: 2.5rem 0; }
.np-update .np-update__side { min-width: 0; }
.np-update .np-update__label { margin: 0; font-size: 0.9375rem; font-weight: 600; line-height: 1.4; color: var(--npb-text-primary, inherit); scroll-margin-top: 6rem; }
.np-update .np-update__description { margin: 0.35rem 0 0; font-size: 0.875rem; line-height: 1.5; color: var(--npb-text-secondary, #52525b); }
.np-update .np-update__body { min-width: 0; }
.np-update .np-update__body > :first-child { margin-top: 0; }
@media (max-width: 767px) {
  .np-update { grid-template-columns: minmax(0, 1fr); row-gap: 0.5rem; margin: 2rem 0; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .np-update { grid-template-columns: minmax(0, 1fr); row-gap: 0.5rem; margin: 2rem 0; }
}
`.trim();
