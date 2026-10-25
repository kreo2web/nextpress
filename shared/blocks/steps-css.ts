/**
 * Steps look, shared by the editor canvas and published pages (same classes, same structure).
 *
 * Numbers come from a CSS counter (`np-step`), so reordering steps renumbers them with no
 * saved numbers. The number or dot marker is the step's `::before`; the icon marker is a real
 * element (`.np-step__icon`, drawn only when Steps use the "icon" marker) that takes the same
 * circle and the same place. The connector to the next step is the step's `::after`. Each step
 * owns its connector (hidden on the last one), because the editor wraps every step in a drag
 * wrapper and sibling selectors would not reach across it.
 *
 * Vertical is the base: a line down the page. Horizontal is a row, and its connector is an arrow
 * (a line with an open arrowhead, one mask over the line colour) that stops short of the next
 * marker. Phones put horizontal back to vertical: `@media` for real phones, `@container npb-canvas`
 * for the editor's device preview.
 */

const PHONE_MAX = "767px";

/** The timeline line is quiet, so the markers lead. */
const TIMELINE_LINE = "var(--npb-border-default,#e2e8f0)";
/** An arrow has to read as "next", so it takes a stronger colour than the quiet timeline line. */
const ARROW_LINE = "var(--npb-text-muted,#94a3b8)";

/** An open arrowhead, 7 x 12 px, as a mask: only its shape counts, the colour is the line colour behind it. */
const ARROW_HEAD =
	"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 7 12' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l5 5-5 5'/%3E%3C/svg%3E\")";
/** The arrowhead at the right end and a 2px line running up to it. */
const ARROW_MASK = `${ARROW_HEAD} right center/7px 12px no-repeat,linear-gradient(#000,#000) left center/calc(100% - 6px) 2px no-repeat`;

/** Both kinds of marker (the stylesheet's circle and the icon element) get the same rules. */
const markers = (scope: string): string => `${scope} .wp-block-step::before,${scope} .np-step__icon`;

/** Rules that make a Steps block a timeline down the page. `scope` is the selector prefix. */
const verticalRules = (scope: string): string => `
${scope}{--np-steps-line:${TIMELINE_LINE}}
${scope} .np-steps__items{display:flex!important;flex-direction:column!important;gap:0!important}
${scope} .wp-block-step{grid-template-columns:var(--np-steps-box,2rem) minmax(0,1fr);column-gap:1rem;padding-bottom:1.75rem}
${markers(scope)}{grid-column:1;grid-row:1 / span 2;justify-self:center;margin:calc((var(--np-steps-box,2rem) - var(--np-steps-marker,2rem)) / 2) 0 0}
${scope} .np-step__title{grid-column:2;grid-row:1;line-height:var(--np-steps-box,2rem)}
${scope} .np-step__body{grid-column:2;grid-row:2}
${scope} .np-steps__items .wp-block-step::after{left:calc(var(--np-steps-box,2rem) / 2 - 1px);right:auto;top:calc((var(--np-steps-box,2rem) - var(--np-steps-marker,2rem)) / 2 + var(--np-steps-marker,2rem) + 0.375rem);bottom:0.375rem;width:2px;height:auto;-webkit-mask:none;mask:none}
`;

/**
 * Rules that make a Steps block a row: marker on top, then an arrow to the next step. The arrow
 * starts `--np-steps-clear` after this marker and ends `--np-steps-clear` before the next one (the
 * next step starts one `--np-steps-gap` past this step's right edge), so it never touches a marker.
 */
const horizontalRules = (scope: string): string => `
${scope}{--np-steps-line:${ARROW_LINE}}
${scope} .np-steps__items{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0 var(--np-steps-gap,1.5rem)!important}
${scope} .wp-block-step{grid-template-columns:minmax(0,1fr);column-gap:0;padding-bottom:0}
${markers(scope)}{grid-column:1;grid-row:1;justify-self:start;margin:0 0 0.75rem}
${scope} .np-step__title{grid-column:1;grid-row:2;line-height:1.4}
${scope} .np-step__body{grid-column:1;grid-row:3}
${scope} .np-steps__items .wp-block-step::after{top:calc(var(--np-steps-marker,2rem) / 2 - 6px);left:calc(var(--np-steps-marker,2rem) + var(--np-steps-clear,0.5rem));right:calc(var(--np-steps-clear,0.5rem) - var(--np-steps-gap,1.5rem));bottom:auto;width:auto;height:12px;-webkit-mask:${ARROW_MASK};mask:${ARROW_MASK}}
`;

const BASE_CSS = `
.wp-block-steps{--np-steps-box:2rem;--np-steps-marker:2rem;--np-steps-glyph:calc(var(--np-steps-marker) / 2);--np-steps-gap:1.5rem;--np-steps-clear:0.5rem;--np-steps-accent:var(--npb-accent,#2563eb);width:100%}
.wp-block-steps.np-steps--dot{--np-steps-marker:0.75rem}
.np-steps__items{list-style:none;margin:0;padding:0;counter-reset:np-step;width:100%;min-width:0}
.wp-block-step{counter-increment:np-step;position:relative;display:grid;min-width:0;margin:0;list-style:none}
.wp-block-step::before,.np-step__icon{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:var(--np-steps-marker,2rem);height:var(--np-steps-marker,2rem);border:2px solid var(--np-steps-accent,#2563eb);border-radius:9999px;background:var(--npb-surface-base,transparent);color:var(--np-steps-accent,#2563eb)}
.wp-block-step::before{content:counter(np-step);font-size:0.875rem;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.np-steps--dot .wp-block-step::before{content:"";background:var(--np-steps-accent,#2563eb)}
.np-steps--icon .wp-block-step::before{content:none;display:none}
.np-step__icon{flex:none}
.np-step__glyph{display:block;width:var(--np-steps-glyph,1rem);height:var(--np-steps-glyph,1rem);line-height:0}
.np-step__glyph>svg{display:block;width:100%;height:100%}
.np-step__title{margin:0;font-size:1.125rem;font-weight:600;min-width:0}
.np-step__body{min-width:0;margin-top:0.25rem}
.np-steps__items .wp-block-step::after{content:"";position:absolute;background:var(--np-steps-line,#e2e8f0);border-radius:1px}
.np-steps__items > .wp-block-step:last-child::after,
.np-steps__items > :last-child .wp-block-step::after{display:none}
.np-steps__items > .wp-block-step:last-child,
.np-steps__items > :last-child .wp-block-step{padding-bottom:0!important}
${verticalRules(".wp-block-steps")}
${horizontalRules(".wp-block-steps.np-steps--horizontal")}
@media (forced-colors:active){.np-steps__items .wp-block-step::after{background:CanvasText}}
`;

const PHONE_CSS = `
@media (max-width:${PHONE_MAX}){${verticalRules(".wp-block-steps.np-steps--horizontal")}}
@container npb-canvas (max-width:${PHONE_MAX}){${verticalRules(".npb-canvas-page .wp-block-steps.np-steps--horizontal")}}
`;

/** Published and editor CSS for Steps and Step, appended to the page's block CSS. */
export const STEPS_CSS = (BASE_CSS + PHONE_CSS).trim();
