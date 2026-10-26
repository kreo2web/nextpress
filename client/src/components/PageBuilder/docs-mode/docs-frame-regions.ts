import type { DocsFrameRegion } from "./docs-types";

/**
 * What a click on the docs frame does in the editor. Links between pages (sidebar, breadcrumbs,
 * previous/next) open that page, as they would for a visitor. The top bar opens its settings and
 * the rest of the sidebar shows the Pages tab. Search and the phone Menu button keep their own job.
 */

/** The frame's links between the pages of the docs. */
const PAGE_LINKS = ".np-docs__sidebar a[href], .np-docs__crumbs a[href], .np-docs__pager a[href]";

/** The address a clicked page link points to, or null when the click wasn't on one. */
export function readFramePageLink(target: Element): string | null {
	return target.closest(PAGE_LINKS)?.getAttribute("href") ?? null;
}

/** Controls that must keep doing their own job when clicked, even inside the top bar or the sidebar. */
const OWN_JOB = "[data-np-docs-menu], [data-np-docs-close], [data-np-docs-backdrop]";

/** Which part of the frame was clicked, or null for the page itself and for the controls that keep their own job. */
export function readFrameRegion(target: Element): DocsFrameRegion | null {
	if (target.closest(OWN_JOB)) return null;
	if (target.closest(".np-dshell__bar")) return "header";
	if (target.closest(".np-docs__sidebar")) return "sidebar";
	return null;
}

/**
 * Editor-only look for the top bar: an outline and a small name while the pointer is over it, since
 * a click there opens settings. The sidebar gets none: its links work as links. Drawn with CSS on
 * the frame's own classes, so the published markup carries nothing extra.
 */
export const DOCS_FRAME_EDITOR_CSS = `
.npb-docs-frame .np-dshell__bar { cursor: pointer; }
.npb-docs-frame .np-dshell__bar:hover {
  outline: 2px solid var(--npb-accent, #3b82f6);
  outline-offset: -2px;
}
.npb-docs-frame .np-dshell__bar:hover::after {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 60;
  padding: 3px 7px;
  border-radius: 0 0 4px 0;
  background: var(--npb-accent, #3b82f6);
  color: #ffffff;
  font: 600 11px/1.2 system-ui, sans-serif;
  letter-spacing: 0.02em;
  pointer-events: none;
}
.npb-docs-frame .np-dshell__bar:hover::after { content: "Header"; }
@media (prefers-reduced-motion: no-preference) {
  .npb-docs-frame .np-dshell__bar { transition: outline-color 0.12s ease; }
}
`;
