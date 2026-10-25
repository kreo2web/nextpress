/**
 * File tree: a monospace nested list with folder and file icons. Shared by the block and MDX
 * `<FileTree>` (same classes). A highlighted line takes the accent. Phone rules twice, as in tabs-css.ts.
 */
export const FILE_TREE_CSS = `
.wp-block-file-tree { width: 100%; min-width: 0; }
.np-file-tree {
  margin: 1.25em 0;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  border: 1px solid var(--npb-border-default, #e2e8f0);
  border-radius: 8px;
  background: var(--npb-surface-muted, #f8fafc);
  color: var(--npb-text-primary, #0f172a);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}
.wp-block-file-tree > .np-file-tree { margin: 0; }
.np-file-tree ul { list-style: none; margin: 0; padding: 0; }
.np-file-tree ul ul { margin-left: 0.55rem; padding-left: 0.85rem; border-left: 1px solid var(--npb-border-default, #e2e8f0); }
.np-file-tree-item { margin: 0; padding: 0; }
.np-file-tree-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.1rem 0; white-space: nowrap; }
.np-file-tree-icon {
  flex: none;
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--npb-text-secondary, #64748b);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.np-file-tree-item[data-kind="folder"] > .np-file-tree-row .np-file-tree-name { font-weight: 600; }
.np-file-tree-item[data-highlight] > .np-file-tree-row .np-file-tree-name { color: var(--npb-accent, #2563eb); font-weight: 700; }
.np-file-tree-item[data-highlight] > .np-file-tree-row .np-file-tree-icon { stroke: var(--npb-accent, #2563eb); }
.np-file-tree-note { color: var(--npb-text-secondary, #64748b); font-style: italic; }
.np-file-tree-note::before { content: "# "; }

@media (max-width: 767px) {
  .np-file-tree { padding: 0.625rem 0.75rem; font-size: 0.8125rem; }
  .np-file-tree ul ul { padding-left: 0.65rem; }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .np-file-tree { padding: 0.625rem 0.75rem; font-size: 0.8125rem; }
  .npb-canvas-page .np-file-tree ul ul { padding-left: 0.65rem; }
}
`;
