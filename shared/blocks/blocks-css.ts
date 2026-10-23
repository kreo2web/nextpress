import { BADGE_CSS } from "./badge-css.js";
import { CARD_CSS } from "./card-css.js";
import { DOCS_LAYOUT_CSS } from "./docs-layout-css.js";
import { COLUMNS_EXTRAS_CSS } from "./columns-extras-css.js";
import { GRID_CSS } from "./grid-css.js";
import { LIST_MARKERS_CSS } from "./list-markers-css.js";
import { LOGO_CLOUD_CSS } from "./logo-cloud-css.js";
import { SEARCH_CSS } from "./search-css.js";
import { STEPS_CSS } from "./steps-css.js";
import { TABS_CSS } from "./tabs-css.js";

/**
 * CSS for the section blocks, appended to PUBLISH_BLOCK_CSS so the editor and the published page
 * share it. Each block owns its file; phone rules use both `@media` (published) and
 * `@container npb-canvas` (the editor's device preview), at phone ≤767px and tablet 768–1023px.
 */
export const DESIGN_BLOCKS_CSS = [GRID_CSS, CARD_CSS, BADGE_CSS, STEPS_CSS, TABS_CSS, LOGO_CLOUD_CSS, LIST_MARKERS_CSS, COLUMNS_EXTRAS_CSS, SEARCH_CSS, DOCS_LAYOUT_CSS].filter(Boolean).join("\n");
