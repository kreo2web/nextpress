/**
 * Look of the Code group block and the MDX `<CodeGroup>` tag (same classes, one sheet). It is Tabs
 * markup with `np-code-group`, so `TABS_CSS` does the switching; here the tab bar joins the dark
 * code box: no gap, one border around both (drawn on the bar and the panels, not the block's own
 * box, which carries the block's spacing), and the code's own title and language (now on the
 * tab) hidden so the label isn't said twice. Loaded after `TABS_CSS`, so equal rules win here.
 */
const group = (scope: string): string => `
${scope}.wp-block-tabs.np-code-group { margin: 1.25em 0; }
${scope}.np-code-group .np-tabs__list { display: flex; gap: 0; background: #1b1f29; border: 1px solid #2a2f3b; border-bottom-color: rgba(255, 255, 255, 0.08); border-radius: 8px 8px 0 0; padding: 0; }
${scope}.np-code-group .np-tabs__tab { color: #9aa3b2; font-size: 0.8125rem; padding: 0.6rem 1rem; border-radius: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; box-shadow: none; }
${scope}.np-code-group .np-tabs__tab:hover { color: #dce1ea; }
${scope}.np-code-group .np-tabs__tab[aria-selected="true"] { color: #dce1ea; background: #151820; border-bottom-color: var(--npb-accent, #2563eb); }
${scope}.np-code-group .np-tabs__tab:focus-visible { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: -2px; }
${scope}.np-code-group .np-tabs__panels { padding-top: 0; background: #151820; border: 1px solid #2a2f3b; border-top: 0; border-radius: 0 0 8px 8px; overflow: hidden; }
${scope}.np-code-group .wp-block-tab:not([hidden]) { gap: 0; }
${scope}.np-code-group .wp-block-code { margin: 0 !important; max-width: 100% !important; }
${scope}.np-code-group .np-code { margin: 0; border-radius: 0; }
${scope}.np-code-group .np-code-title,
${scope}.np-code-group .np-code-language { display: none; }
${scope}.np-code-group .np-code-copy { margin-left: auto; }
${scope}.np-code-group .np-code-header { border-bottom: 0; padding-bottom: 0; justify-content: flex-end; }
`;

const phone = (scope: string): string => `
${scope}.np-code-group .np-tabs__tab { padding: 0.55rem 0.8rem; }
`;



/** Published and editor CSS for the code group (phone rules twice, as in tabs-css.ts). */
export const CODE_GROUP_CSS = `${group("")}
@media (max-width: 767px) {${phone("")}}
@container npb-canvas (max-width: 767px) {${phone(".npb-canvas-page ")}}
`.trim();
