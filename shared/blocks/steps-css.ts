/**
 * Steps look, shared by the editor canvas and published pages (same classes, same structure).
 *
 * Numbers come from a CSS counter (`np-step`), so reordering steps renumbers them with no
 * saved numbers. The marker is the step's `::before`; the line to the next step is its `::after`.
 * Each step owns its connector (hidden on the last one), because the editor wraps every step in
 * a drag wrapper and sibling selectors would not reach across it.
 *
 * Vertical is the base. Horizontal changes only the layout rules, and phones put horizontal back
 * to vertical: `@media` for real phones, `@container npb-canvas` for the editor's device preview.
 */

const PHONE_MAX = "767px";

/** Rules that make a Steps block a timeline down the page. `scope` is the selector prefix. */
const verticalRules = (scope: string): string => `
${scope} .np-steps__items{display:flex!important;flex-direction:column!important;gap:0!important}
${scope} .wp-block-step{grid-template-columns:var(--np-steps-box,2rem) minmax(0,1fr);column-gap:1rem;padding-bottom:1.75rem}
${scope} .wp-block-step::before{grid-column:1;grid-row:1 / span 2;justify-self:center;margin:calc((var(--np-steps-box,2rem) - var(--np-steps-marker,2rem)) / 2) 0 0}
${scope} .np-step__title{grid-column:2;grid-row:1;line-height:var(--np-steps-box,2rem)}
${scope} .np-step__body{grid-column:2;grid-row:2}
${scope} .np-steps__items .wp-block-step::after{left:calc(var(--np-steps-box,2rem) / 2 - 1px);right:auto;top:calc((var(--np-steps-box,2rem) - var(--np-steps-marker,2rem)) / 2 + var(--np-steps-marker,2rem) + 0.375rem);bottom:0.375rem;width:2px;height:auto}
`;

/** Rules that make a Steps block a row: marker on top, a line to the next step. */
const horizontalRules = (scope: string): string => `
${scope} .np-steps__items{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0 1.5rem!important}
${scope} .wp-block-step{grid-template-columns:minmax(0,1fr);column-gap:0;padding-bottom:0}
${scope} .wp-block-step::before{grid-column:1;grid-row:1;justify-self:start;margin:0 0 0.75rem}
${scope} .np-step__title{grid-column:1;grid-row:2;line-height:1.4}
${scope} .np-step__body{grid-column:1;grid-row:3}
${scope} .np-steps__items .wp-block-step::after{top:calc(var(--np-steps-marker,2rem) / 2 - 1px);left:calc(var(--np-steps-marker,2rem) + 0.5rem);right:-1rem;bottom:auto;width:auto;height:2px}
`;

const BASE_CSS = `
.wp-block-steps{--np-steps-box:2rem;--np-steps-marker:2rem;--np-steps-accent:var(--npb-accent,#2563eb);--np-steps-line:var(--npb-border-default,#e2e8f0);width:100%}
.wp-block-steps.np-steps--dot{--np-steps-marker:0.75rem}
.np-steps__items{list-style:none;margin:0;padding:0;counter-reset:np-step;width:100%;min-width:0}
.wp-block-step{counter-increment:np-step;position:relative;display:grid;min-width:0;margin:0;list-style:none}
.wp-block-step::before{content:counter(np-step);box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:var(--np-steps-marker,2rem);height:var(--np-steps-marker,2rem);border:2px solid var(--np-steps-accent,#2563eb);border-radius:9999px;background:var(--npb-surface-base,transparent);color:var(--np-steps-accent,#2563eb);font-size:0.875rem;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.np-steps--dot .wp-block-step::before{content:"";background:var(--np-steps-accent,#2563eb)}
.np-step__title{margin:0;font-size:1.125rem;font-weight:600;min-width:0}
.np-step__body{min-width:0;margin-top:0.25rem}
.np-steps__items .wp-block-step::after{content:"";position:absolute;background:var(--np-steps-line,#e2e8f0);border-radius:1px}
.np-steps__items > .wp-block-step:last-child::after,
.np-steps__items > :last-child .wp-block-step::after{display:none}
.np-steps__items > .wp-block-step:last-child,
.np-steps__items > :last-child .wp-block-step{padding-bottom:0!important}
${verticalRules(".wp-block-steps")}
${horizontalRules(".wp-block-steps.np-steps--horizontal")}
`;

const PHONE_CSS = `
@media (max-width:${PHONE_MAX}){${verticalRules(".wp-block-steps.np-steps--horizontal")}}
@container npb-canvas (max-width:${PHONE_MAX}){${verticalRules(".npb-canvas-page .wp-block-steps.np-steps--horizontal")}}
`;

/** Published and editor CSS for Steps and Step, appended to the page's block CSS. */
export const STEPS_CSS = (BASE_CSS + PHONE_CSS).trim();
