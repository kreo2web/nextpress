/**
 * Bullet shapes for unordered lists. "default" keeps the browser's own bullets; the others replace
 * them with a drawn marker. Shared by the editor list and the published list so the choice reads
 * the same in both.
 */
export const LIST_MARKERS = ["default", "check", "arrow", "dash", "none"] as const;
export type ListMarker = (typeof LIST_MARKERS)[number];

/**
 * Unknown or missing values fall back to the browser's bullets, so a bad saved value never
 * changes how an existing list looks.
 */
export function readListMarker(value: string | undefined): ListMarker {
	return LIST_MARKERS.find((marker) => marker === value) ?? "default";
}

/**
 * Items draw their marker with `::before` in their own indent (the list's padding comes from the
 * block's spacing, so it can't be relied on) and the list drops the browser bullet. The check is a
 * mask in the accent colour, so it stays crisp at any size. Arrow and dash are plain characters.
 * Only unordered lists get these classes, so ordered numbering is never touched.
 */
export const LIST_MARKERS_CSS = `
.wp-block-list.np-list--check,
.wp-block-list.np-list--arrow,
.wp-block-list.np-list--dash,
.wp-block-list.np-list--none {
  list-style: none;
  padding-left: 0;
}
.wp-block-list.np-list--check > li,
.wp-block-list.np-list--arrow > li,
.wp-block-list.np-list--dash > li {
  position: relative;
  padding-left: 1.5em;
}
.wp-block-list.np-list--check > li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.35em;
  width: 0.9em;
  height: 0.9em;
  background-color: var(--npb-accent, currentColor);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
}
.wp-block-list.np-list--arrow > li::before,
.wp-block-list.np-list--dash > li::before {
  position: absolute;
  left: 0;
  top: 0;
  color: var(--npb-accent, currentColor);
}
.wp-block-list.np-list--arrow > li::before {
  content: "→";
}
.wp-block-list.np-list--dash > li::before {
  content: "–";
}
`;
