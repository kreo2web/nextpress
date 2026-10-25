import type { DocsFrameRegion } from "./docs-types";

/**
 * The two parts of the docs frame that open settings when clicked: the top bar and the sidebar.
 * Everything inside them (links, search, the phone Menu button) keeps working, so the page and
 * the sidebar behave on the canvas as they do for visitors.
 */

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
 * Editor-only look for those two parts: an outline and a small name while the pointer is over
 * them. Drawn with CSS on the frame's own classes, so the published markup carries nothing extra.
 */
export const DOCS_FRAME_EDITOR_CSS = `
.npb-docs-frame .np-dshell__bar,
.npb-docs-frame .np-docs__sidebar { cursor: pointer; }
.npb-docs-frame .np-dshell__bar:hover,
.npb-docs-frame .np-docs__sidebar:hover {
  outline: 2px solid var(--npb-accent, #3b82f6);
  outline-offset: -2px;
}
.npb-docs-frame .np-dshell__bar:hover::after,
.npb-docs-frame .np-docs__sidebar:hover::after {
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
.npb-docs-frame .np-docs__sidebar:hover::after { content: "Sidebar"; }
@media (prefers-reduced-motion: no-preference) {
  .npb-docs-frame .np-dshell__bar, .npb-docs-frame .np-docs__sidebar { transition: outline-color 0.12s ease; }
}
`;
