/**
 * Look of the docs shell (top bar, sidebar) and the docs page (title, reading column, contents),
 * for the published page and the editor canvas alike. It reuses the sidebar, breadcrumb, pager
 * and contents classes from the docs layout sheet (`np-docs__*`) so the old and new look match.
 * Colours come from the page's --npb-* tokens with fallbacks; only transform and opacity move
 * (the phone drawer), and not under reduced motion.
 *
 * The frame follows the docs bars of Vercel and Mintlify: the top bar spans the window with a
 * hairline under it, and everything below sits in one centred box about 1440px wide.
 *   Desktop (1280px and wider): sidebar 260px | reading column up to 760px | "On this page" 220px.
 *   Tablet (768-1279px): "On this page" folds into a disclosure above the content; at 1023px and
 *   below the sidebar narrows too.
 *   Phone (767px and narrower): the sidebar becomes a drawer behind Menu; search stays in the top
 *   bar as an icon; the links and the button move into the drawer.
 * Each responsive rule is written for `@media` (published) and `@container npb-canvas` (the
 * editor's device preview), like the other blocks. These numbers are the only place the frame's
 * widths and spacing live, so a docs page needs no padding of its own.
 */

const PHONE_MAX = "767px";
const NARROW_MAX = "1023px";
const TOC_FOLD_MAX = "1279px";

/** Where the box starts at any window width: 1.5rem in from the edge, centred once past 90rem. */
const BOX_INSET = "max(1.5rem, calc((100% - 90rem) / 2 + 1.5rem))";

const BAR_CSS = `
/* Published pages have no global reset, so the frame's own boxes size to include their padding. */
.np-dshell, .np-dshell__bar, .np-dshell__body, .np-dshell__main, .np-dshell .np-docs__sidebar, .np-dpage, .np-dpage__main, .np-dpage .np-docs__toc { box-sizing: border-box; }
.np-dshell { position: relative; width: 100%; color: var(--npb-text-primary, #18181b); }
.np-dshell a:focus-visible, .np-dshell button:focus-visible, .np-dshell summary:focus-visible {
  outline: 2px solid var(--npb-focus, var(--npb-accent, #3b82f6));
  outline-offset: 2px;
}
.np-dshell__bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 3.5rem;
  padding: 0.5rem ${BOX_INSET};
  border-bottom: 1px solid var(--npb-border-default, #e4e4e7);
  background: var(--npb-surface-base, #ffffff);
}
.np-dshell__brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  color: inherit;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
}
.np-dshell__logo { display: block; height: 1.5rem; width: auto; max-width: 8rem; object-fit: contain; }
.np-dshell__logo--dark { display: none; }
.dark .np-dshell--dark-logo .np-dshell__logo--light, [data-theme="dark"] .np-dshell--dark-logo .np-dshell__logo--light { display: none; }
.dark .np-dshell__logo--dark, [data-theme="dark"] .np-dshell__logo--dark { display: block; }
.np-dshell__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.np-dshell__search {
  flex: 0 1 21rem;
  width: 100%;
  max-width: 21rem;
  min-width: 0;
  min-height: 2.25rem;
  margin-left: 0.75rem;
  padding: 0.3rem 0.6rem 0.3rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--npb-surface-raised, #fafafa);
  font-size: 0.875rem;
}
.np-dshell__end { display: flex; align-items: center; gap: 1.25rem; margin-left: auto; min-width: 0; }
.np-dshell__links { display: flex; align-items: center; gap: 1.25rem; }
.np-dshell__link { color: var(--npb-text-secondary, #52525b); font-size: 0.875rem; text-decoration: none; white-space: nowrap; }
.np-dshell__link:hover { color: var(--npb-text-primary, #18181b); }
.np-dshell__button {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 1rem;
  border-radius: 0.5rem;
  background: var(--npb-accent, #2563eb);
  color: var(--npb-accent-foreground, #ffffff);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}
.np-dshell__button:hover { background: var(--npb-accent-hover, var(--npb-accent, #1d4ed8)); filter: brightness(0.94); }
.np-dshell__drawer-links, .np-dshell__button--drawer { display: none; }
.np-dshell .np-docs__menu { display: none; }
`;

const BODY_CSS = `
.np-dshell__body {
  display: grid;
  grid-template-columns: 16.25rem minmax(0, 1fr);
  align-items: start;
  width: 100%;
  max-width: 90rem;
  margin-inline: auto;
  padding: 0 1.5rem;
}
.np-dshell--no-nav .np-dshell__body { grid-template-columns: minmax(0, 1fr); }
.np-dshell .np-docs__sidebar {
  top: 3.5rem;
  height: calc(100vh - 3.5rem);
  max-height: calc(100vh - 3.5rem);
  padding: 1.5rem 1.25rem 2rem 0;
}
.np-dshell .np-docs__group { margin-top: 1rem; padding-bottom: 0.2rem; font-size: 0.8125rem; }
.np-dshell .np-docs__list > li:first-child > .np-docs__group { margin-top: 0; }
.np-dshell .np-docs__group + .np-docs__list { margin: 0; padding-left: 0; border-left: 0; }
.np-dshell__main { min-width: 0; padding: 2.5rem 0 5rem 2.5rem; }
.np-dshell--no-nav .np-dshell__main { padding-left: 0; }
.np-dshell .np-docs__content :is(h2, h3, h4) { scroll-margin-top: 5rem; }

.np-dpage {
  display: grid;
  grid-template-columns: minmax(0, 47.5rem) 13.75rem;
  gap: 3rem;
  align-items: start;
  justify-content: center;
  width: 100%;
}
.np-dpage--no-toc { grid-template-columns: minmax(0, 47.5rem); }
.np-dpage__main { min-width: 0; }
.np-dpage .np-docs__toc { top: 5rem; max-height: calc(100vh - 7rem); }
.np-dpage__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem 1rem; margin-bottom: 0.75rem; }
.np-dpage__title { margin: 0; font-size: 2.25rem; line-height: 1.15; letter-spacing: -0.02em; font-weight: 700; overflow-wrap: anywhere; }
.np-dpage__head .np-docs__toolbar { margin-bottom: 0; }
.np-dpage__head .np-docs__action { min-height: 2rem; padding: 0.2rem 0.65rem; font-size: 0.8125rem; }
.np-dpage__description { margin: 0 0 1.5rem; font-size: 1.1rem; line-height: 1.55; color: var(--npb-text-secondary, #52525b); }
.np-dpage .np-docs__toc-fold { margin-top: 0.5rem; }
`;

const BASE_CSS = BAR_CSS + BODY_CSS;

/** Below 1280px the right column is gone; its links live in the disclosure above the content. */
const tocFoldRules = (root: string): string => `
${root} .np-dpage, ${root} .np-dpage--no-toc { grid-template-columns: minmax(0, 47.5rem); }
${root} .np-dpage .np-docs__toc { display: none; }
${root} .np-dpage .np-docs__toc-fold { display: block; }
`;

/** Tablet: the sidebar narrows to give the page its room. */
const narrowRules = (root: string): string => `
${root} .np-dshell__body { grid-template-columns: 13rem minmax(0, 1fr); }
${root} .np-dshell--no-nav .np-dshell__body { grid-template-columns: minmax(0, 1fr); }
${root} .np-dshell__main { padding-left: 1.5rem; }
${root} .np-dshell--no-nav .np-dshell__main { padding-left: 0; }
`;

/** Phone: one column, the sidebar slides in over the page from the left, search stays in the bar as an icon. */
const phoneRules = ({ root, drawer }: { root: string; drawer: "fixed" | "absolute" }): string => `
${root} .np-dshell__bar { padding: 0.5rem 1rem; gap: 0.6rem; }
${root} .np-dshell .np-docs__menu { display: inline-flex; }
${root} .np-dshell__end { display: none; }
${root} .np-dshell__drawer-links { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--npb-border-default, #e4e4e7); }
${root} .np-dshell__drawer-links .np-dshell__link { padding: 0.3rem 0.5rem; }
${root} .np-dshell__button--drawer { display: inline-flex; justify-content: center; margin-top: 1rem; }
${root} .np-dshell__search { flex: none; width: auto; min-width: 0; margin-left: auto; padding: 0.45rem 0.6rem; }
${root} .np-dshell__search .np-search__label { display: none; }
${root} .np-dshell__title { max-width: 9rem; }
${root} .np-dshell__body { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0 1rem; }
${root} .np-dshell__main { padding: 1.25rem 0 3rem; }
${root} .np-dshell .np-docs__close { display: inline-flex; margin-bottom: 0.75rem; }
${root} .np-dshell .np-docs__sidebar {
  position: ${drawer};
  inset: 0 auto 0 0;
  z-index: 50;
  width: min(20rem, 85%);
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
${root} .np-dshell[data-menu-open="true"] .np-docs__sidebar { visibility: visible; transform: none; transition-delay: 0s; }
${root} .np-dshell .np-docs__backdrop {
  display: block;
  position: ${drawer};
  inset: 0;
  z-index: 49;
  background: rgba(9, 9, 11, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}
${root} .np-dshell[data-menu-open="true"] .np-docs__backdrop { opacity: 1; pointer-events: auto; }
${root} .np-dpage__title { font-size: 1.75rem; }
${root} .np-dpage__head .np-docs__toolbar { flex-basis: 100%; }
${root} .np-dpage .np-docs__pager { flex-direction: column; }
${root} .np-dpage .np-docs__pager-link--next { text-align: left; margin-left: 0; }
`;

const NO_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .np-dshell .np-docs__sidebar, .np-dshell .np-docs__backdrop { transition: none; }
}
`;

const RESPONSIVE_CSS = `
@media (max-width:${TOC_FOLD_MAX}){${tocFoldRules("")}}
@container npb-canvas (max-width:${TOC_FOLD_MAX}){${tocFoldRules(".npb-canvas-page")}}
@media (max-width:${NARROW_MAX}){${narrowRules("")}}
@container npb-canvas (max-width:${NARROW_MAX}){${narrowRules(".npb-canvas-page")}}
@media (max-width:${PHONE_MAX}){${phoneRules({ root: "", drawer: "fixed" })}}
@container npb-canvas (max-width:${PHONE_MAX}){${phoneRules({ root: ".npb-canvas-page", drawer: "absolute" })}}
`;

/** Published and editor CSS for the docs shell and docs page, appended to the page's block CSS. */
export const DOCS_SHELL_CSS = (BASE_CSS + RESPONSIVE_CSS + NO_MOTION_CSS).trim();
