/**
 * Docs heading, text and list blocks. Each wraps itself in `.np-prose`, so its type comes from the
 * same rules as a page written as one MDX block; here only the box, the "#" link on a heading and
 * checklists. Phone rules twice, as in tabs-css.ts.
 */
export const DOCS_PROSE_CSS = `
.wp-block-docs-heading, .wp-block-docs-text, .wp-block-docs-list { width: 100%; min-width: 0; }
.wp-block-docs-heading.np-prose > :where(h2, h3, h4) { margin: 0; }
.wp-block-docs-text.np-prose > p { margin: 0; }
.wp-block-docs-list.np-prose > :where(ul, ol) { margin: 0; }
.np-doc-heading { position: relative; }
.np-heading-anchor { margin-left: 0.4em; color: var(--npb-text-muted, #71717a); text-decoration: none; opacity: 0; transition: opacity 0.12s ease; }
.np-doc-heading:hover .np-heading-anchor, .np-heading-anchor:focus-visible { opacity: 1; }
.np-heading-anchor:hover { color: var(--npb-accent, #2563eb); }
.np-heading-anchor:focus-visible { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: 2px; border-radius: 3px; }
@media (prefers-reduced-motion: reduce) { .np-heading-anchor { transition: none; } }
.np-prose .np-doc-checklist, .np-prose .np-doc-checklist ul, .np-prose .np-doc-checklist ol { list-style: none; padding-left: 0; }
.np-prose .np-doc-checklist ul, .np-prose .np-doc-checklist ol { padding-left: 1.5em; }
.np-prose .np-doc-checklist li:has(> input[type="checkbox"]) { margin-left: 0; }
.np-doc-checklist li > input[type="checkbox"] { margin-right: 0.5em; vertical-align: -0.1em; accent-color: var(--npb-accent, #2563eb); }

@media (max-width: 767px) {
  .wp-block-docs-heading :where(h2, h3, h4) { overflow-wrap: anywhere; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-docs-heading :where(h2, h3, h4) { overflow-wrap: anywhere; }
}
`;
