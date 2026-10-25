/**
 * MDX `<Accordion>`: a native details with the Accordion block's classes and its default look
 * (cards, plus and minus icon). The block's own look is written per block id, so this is the
 * same look written once for markdown, where there is no block to hold the settings.
 */
export const DOC_ACCORDION_CSS = `
.np-prose .np-accordion--doc { display: flex; flex-direction: column; margin: 0.75em 0; }
.np-prose .np-accordion--doc .np-accordion__item { background: var(--npb-surface-base, #fff); border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 14px; box-shadow: 0 2px 2px rgba(15, 23, 42, 0.04); overflow: hidden; }
.np-prose .np-accordion--doc .np-accordion__title { display: flex; align-items: center; gap: 14px; cursor: pointer; list-style: none; padding: 20px 24px; font-size: 16px; font-weight: 500; line-height: 1.5; min-width: 0; overflow-wrap: anywhere; }
.np-prose .np-accordion--doc .np-accordion__title::-webkit-details-marker { display: none; }
.np-prose .np-accordion--doc .np-accordion__title:focus-visible { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: -2px; }
.np-prose .np-accordion--doc .np-accordion__icon { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 18px; height: 18px; }
.np-prose .np-accordion--doc .np-accordion__icon svg { width: 100%; height: 100%; }
.np-prose .np-accordion--doc .np-accordion__item[open] .np-accordion__icon-closed,
.np-prose .np-accordion--doc .np-accordion__item:not([open]) .np-accordion__icon-open { display: none; }
.np-prose .np-accordion--doc .np-accordion__body { padding: 0 24px 20px; }
.np-prose .np-accordion--doc .np-accordion__body > :first-child { margin-top: 0; }
.np-prose .np-accordion--doc .np-accordion__body > :last-child { margin-bottom: 0; }
`;
