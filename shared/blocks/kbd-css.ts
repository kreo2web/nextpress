/** Inline keyboard keys (`<Kbd>` in MDX): a small key cap, for the published page and the editor alike. */
export const KBD_CSS = `
.np-kbd {
  display: inline-block;
  min-width: 1.5em;
  padding: 0.1em 0.45em;
  border: 1px solid var(--npb-border-default, #cbd5e1);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--npb-surface-raised, #f8fafc);
  color: var(--npb-text-primary, #0f172a);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
  line-height: 1.4;
  text-align: center;
  vertical-align: baseline;
  white-space: nowrap;
}
`;
