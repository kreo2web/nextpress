/**
 * Badge: a small pill label. The tone sets `--np-badge`, and the look decides how it is painted,
 * so one stylesheet serves the editor canvas and the published page.
 */
export const BADGE_CSS = `
.np-badge {
  --np-badge: var(--npb-accent, #3b82f6);
  display: inline-block;
  max-width: 100%;
  padding: 0.2em 0.65em;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  vertical-align: middle;
}
.np-badge[data-tone="neutral"] { --np-badge: #71717a; }
.np-badge[data-tone="success"] { --np-badge: #16a34a; }
.np-badge[data-tone="warning"] { --np-badge: #d97706; }
.np-badge[data-tone="danger"] { --np-badge: #dc2626; }
.np-badge--soft {
  background-color: color-mix(in srgb, var(--np-badge) 14%, transparent);
  color: var(--np-badge);
}
.np-badge--outline {
  border: 1px solid var(--np-badge);
  color: var(--np-badge);
}
.np-badge--solid {
  background-color: var(--np-badge);
  color: #ffffff;
}
`;
