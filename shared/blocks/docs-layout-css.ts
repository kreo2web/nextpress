/**
 * Look of the docs layout, for the published page and the editor canvas alike (same classes, one
 * sheet). Colours come from the page's --npb-* tokens with fallbacks. Only transform and opacity
 * move (the phone drawer), and not under reduced motion.
 *
 * Desktop: sidebar | reading column (about 720px) | "On this page", with both sides sticky.
 * Tablet (768–1023px) and below: the right column folds into a disclosure above the content.
 * Phone (≤767px): the sidebar becomes a drawer behind a Menu button.
 * Each responsive rule is written for `@media` (published) and `@container npb-canvas` (the
 * editor's device preview), like the other blocks.
 */

const PHONE_MAX = "767px";
const NARROW_MAX = "1023px";

const BASE_CSS = `
.np-docs {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr) 13.5rem;
  gap: 2.5rem;
  align-items: start;
  position: relative;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  color: var(--npb-text-primary, #18181b);
}
.np-docs--no-nav { grid-template-columns: minmax(0, 1fr) 13.5rem; }
.np-docs--no-toc { grid-template-columns: 15rem minmax(0, 1fr); }
.np-docs--no-nav.np-docs--no-toc { grid-template-columns: minmax(0, 1fr); }

.np-docs__sidebar,
.np-docs__toc {
  position: sticky;
  top: 1.5rem;
  align-self: start;
  max-height: calc(100vh - 3rem);
  overflow: auto;
  scrollbar-width: thin;
  font-size: 0.875rem;
  line-height: 1.4;
}
.np-docs__sidebar { padding-right: 1.25rem; border-right: 1px solid var(--npb-border-default, #e4e4e7); }
.np-docs__toc { padding-left: 0.25rem; }
.np-docs__backdrop, .np-docs__close, .np-docs__bar, .np-docs__toc-fold { display: none; }

.np-docs__list, .np-docs__toc-list, .np-docs__crumbs ol { list-style: none; margin: 0; padding: 0; }
.np-docs__list .np-docs__list {
  margin: 0.1rem 0 0.25rem 0.5rem;
  padding-left: 0.75rem;
  border-left: 1px solid var(--npb-border-default, #e4e4e7);
}
.np-docs__link, .np-docs__group {
  display: block;
  padding: 0.3rem 0.5rem;
  border-radius: 0.4rem;
  color: var(--npb-text-secondary, #52525b);
  text-decoration: none;
}
.np-docs__group { color: var(--npb-text-primary, #18181b); font-weight: 600; }
.np-docs__link:hover { color: var(--npb-text-primary, #18181b); background: var(--npb-surface-muted, #f4f4f5); }
.np-docs__link[aria-current="page"] {
  color: var(--npb-accent, #2563eb);
  background: var(--npb-accent-subtle, rgba(37, 99, 235, 0.08));
  font-weight: 500;
}
.np-docs a:focus-visible, .np-docs button:focus-visible, .np-docs summary:focus-visible {
  outline: 2px solid var(--npb-focus, var(--npb-accent, #3b82f6));
  outline-offset: 2px;
}

.np-docs__main { min-width: 0; width: 100%; max-width: 45rem; justify-self: center; }
.np-docs__content { min-width: 0; }
.np-docs__content :is(h2, h3, h4) { scroll-margin-top: 1.5rem; }

.np-docs__crumbs { margin-bottom: 1rem; font-size: 0.85rem; color: var(--npb-text-muted, #71717a); }
.np-docs__crumbs ol { display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; }
.np-docs__crumbs li + li::before { content: "/"; margin-right: 0.5rem; color: var(--npb-border-strong, #a1a1aa); }
.np-docs__crumbs a { color: inherit; text-decoration: none; }
.np-docs__crumbs a:hover { color: var(--npb-accent, #2563eb); }
.np-docs__crumbs [aria-current="page"] { color: var(--npb-text-primary, #18181b); }

.np-docs__toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
/* Close stays hidden (rule above) until the phone drawer shows it, so it takes no display here. */
.np-docs__action, .np-docs__menu { display: inline-flex; }
.np-docs__action, .np-docs__menu, .np-docs__close {
  align-items: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--npb-border-default, #e4e4e7);
  border-radius: 0.5rem;
  background: var(--npb-surface-raised, #ffffff);
  color: var(--npb-text-secondary, #52525b);
  font: inherit;
  font-size: 0.85rem;
  text-decoration: none;
  cursor: pointer;
}
.np-docs__action:hover, .np-docs__menu:hover, .np-docs__close:hover { color: var(--npb-text-primary, #18181b); border-color: var(--npb-border-strong, #a1a1aa); }

.np-docs__toc-title { margin: 0 0 0.5rem; font-size: 0.8rem; font-weight: 600; color: var(--npb-text-primary, #18181b); }
.np-docs__toc-item a {
  display: block;
  padding: 0.25rem 0 0.25rem 0.75rem;
  border-left: 1px solid var(--npb-border-default, #e4e4e7);
  color: var(--npb-text-muted, #71717a);
  text-decoration: none;
}
.np-docs__toc-item--h3 a { padding-left: 1.5rem; }
.np-docs__toc-item a:hover { color: var(--npb-text-primary, #18181b); }
.np-docs__toc-item a[aria-current="true"] { color: var(--npb-accent, #2563eb); border-left-color: var(--npb-accent, #2563eb); }

.np-docs__toc-fold {
  margin-bottom: 1.25rem;
  border: 1px solid var(--npb-border-default, #e4e4e7);
  border-radius: 0.6rem;
  font-size: 0.9rem;
}
.np-docs__toc-fold summary { padding: 0.6rem 0.9rem; font-weight: 500; cursor: pointer; }
.np-docs__toc-fold nav { padding: 0 0.9rem 0.75rem; }

.np-docs__pager {
  display: flex;
  gap: 1rem;
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--npb-border-default, #e4e4e7);
}
.np-docs__pager-link {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--npb-border-default, #e4e4e7);
  border-radius: 0.6rem;
  text-decoration: none;
  color: var(--npb-text-primary, #18181b);
}
.np-docs__pager-link:hover { border-color: var(--npb-accent, #2563eb); }
.np-docs__pager-link--next { text-align: right; margin-left: auto; }
.np-docs__pager-hint { font-size: 0.78rem; color: var(--npb-text-muted, #71717a); }
.np-docs__pager-title { font-weight: 500; color: var(--npb-accent, #2563eb); overflow-wrap: anywhere; }
`;

/** Below desktop the right column is gone; its links live in the disclosure above the content. */
const narrowRules = (root: string): string => `
${root} { grid-template-columns: 13rem minmax(0, 1fr); gap: 2rem; }
${root}.np-docs--no-nav { grid-template-columns: minmax(0, 1fr); }
${root} .np-docs__toc { display: none; }
${root} .np-docs__toc-fold { display: block; }
`;

/** Phone: one column, and the sidebar slides in over the page from the left. */
const phoneRules = ({ root, drawer }: { root: string; drawer: "fixed" | "absolute" }): string => `
${root} { grid-template-columns: minmax(0, 1fr); gap: 0; }
${root}.np-docs--no-nav { grid-template-columns: minmax(0, 1fr); }
${root} .np-docs__bar { display: flex; margin-bottom: 1rem; }
${root} .np-docs__close { display: inline-flex; margin-bottom: 0.75rem; }
${root} .np-docs__sidebar {
  position: ${drawer};
  inset: 0 auto 0 0;
  z-index: 50;
  width: min(20rem, 85%);
  /* The desktop column sits at the top (align-self: start), which would shrink the drawer to its links. */
  align-self: stretch;
  max-height: none;
  padding: 1rem;
  border-right: 1px solid var(--npb-border-default, #e4e4e7);
  background: var(--npb-surface-base, #ffffff);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.2);
  visibility: hidden;
  transform: translateX(-100%);
  transition: transform 0.22s ease, visibility 0s linear 0.22s;
}
${root}[data-menu-open="true"] .np-docs__sidebar { visibility: visible; transform: none; transition-delay: 0s; }
${root} .np-docs__backdrop {
  display: block;
  position: ${drawer};
  inset: 0;
  z-index: 49;
  background: rgba(9, 9, 11, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}
${root}[data-menu-open="true"] .np-docs__backdrop { opacity: 1; pointer-events: auto; }
${root} .np-docs__pager { flex-direction: column; }
${root} .np-docs__pager-link--next { text-align: left; margin-left: 0; }
`;

const NO_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .np-docs .np-docs__sidebar, .np-docs .np-docs__backdrop { transition: none; }
}
`;

const RESPONSIVE_CSS = `
@media (max-width:${NARROW_MAX}){${narrowRules(".np-docs")}}
@container npb-canvas (max-width:${NARROW_MAX}){${narrowRules(".npb-canvas-page .np-docs")}}
@media (max-width:${PHONE_MAX}){${phoneRules({ root: ".np-docs", drawer: "fixed" })}}
@container npb-canvas (max-width:${PHONE_MAX}){${phoneRules({ root: ".npb-canvas-page .np-docs", drawer: "absolute" })}}
`;

/** Published and editor CSS for the docs layout, appended to the page's block CSS. */
export const DOCS_LAYOUT_CSS = (BASE_CSS + RESPONSIVE_CSS + NO_MOTION_CSS).trim();
