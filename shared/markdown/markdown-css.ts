/**
 * Styles for markdown everywhere it shows (editor canvas, published pages, chat): reading text,
 * code blocks with Kirari's token classes, diagrams and docs components. Appended to
 * `PUBLISH_BLOCK_CSS`, so the editor and the published page can't drift apart.
 *
 * Code blocks keep a dark surface on every page (as the code block always has). Token colors are
 * CSS variables on `.np-code`, so a theme can recolor them without re-highlighting.
 */
export const MARKDOWN_CSS = `
/* ── Reading text ───────────────────────────────────────────── */
.np-prose { line-height: 1.7; overflow-wrap: break-word; }
.np-prose > :first-child { margin-top: 0; }
.np-prose > :last-child { margin-bottom: 0; }
.np-prose :where(h1, h2, h3, h4, h5, h6) { line-height: 1.25; font-weight: 650; margin: 1.75em 0 0.6em; scroll-margin-top: 5rem; }
.np-prose h1 { font-size: 2em; }
.np-prose h2 { font-size: 1.5em; }
.np-prose h3 { font-size: 1.25em; }
.np-prose h4 { font-size: 1.1em; }
.np-prose :where(h5, h6) { font-size: 1em; }
.np-prose :where(p, ul, ol, blockquote, .np-table) { margin: 1em 0; }
.np-prose a { color: var(--npb-accent, #2563eb); text-decoration: underline; text-underline-offset: 0.2em; }
.np-prose :where(ul, ol) { padding-left: 1.5em; }
.np-prose ul { list-style: disc; }
.np-prose ol { list-style: decimal; }
.np-prose li { margin: 0.3em 0; }
.np-prose li > :where(ul, ol) { margin: 0.3em 0; }
.np-prose li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.5em; }
.np-prose li > input[type="checkbox"] { margin-right: 0.5em; }
.np-prose blockquote { border-left: 3px solid var(--npb-border-default, #d4d4d8); padding-left: 1em; color: var(--npb-text-secondary, #52525b); }
.np-prose hr { border: 0; border-top: 1px solid var(--npb-border-default, #d4d4d8); margin: 2em 0; }
.np-prose img { max-width: 100%; height: auto; border-radius: 6px; }
.np-inline-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.875em; padding: 0.15em 0.35em; border-radius: 4px; background: color-mix(in srgb, currentColor 9%, transparent); }
.np-table { overflow-x: auto; }
.np-table table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
.np-table :where(th, td) { padding: 0.5em 0.75em; text-align: left; border-bottom: 1px solid var(--npb-border-default, #e4e4e7); vertical-align: top; }
.np-table th { font-weight: 600; }
/* Chat replies: same rules, smaller steps. */
.np-prose-compact { font-size: 0.875rem; line-height: 1.6; }
.np-prose-compact :where(h1, h2, h3, h4, h5, h6) { font-size: 1em; margin: 1em 0 0.4em; }
.np-prose-compact :where(p, ul, ol, blockquote, .np-table, .np-code, .np-diagram, .np-callout) { margin: 0.6em 0; }
.np-prose-compact .np-code { font-size: 0.8rem; }
.np-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* ── Code blocks ────────────────────────────────────────────── */
.np-code {
  --kirari-text: #dce1ea; --kirari-keyword: #c4a7ff; --kirari-variable: #dce1ea; --kirari-property: #82d4d0;
  --kirari-function: #9dbdff; --kirari-string: #a9d994; --kirari-number: #f3c78a; --kirari-boolean: #f3c78a;
  --kirari-null: #f3c78a; --kirari-comment: #949cab; --kirari-operator: #e9a6b1; --kirari-punctuation: #adb6c6;
  --kirari-type: #8fd4ed; --kirari-regex: #edb98a; --kirari-inserted: #a9d994; --kirari-deleted: #f2a0a9;
  --kirari-heading: #9dbdff; --kirari-tag: #e9a6b1; --kirari-attribute: #82d4d0; --kirari-entity: #f3c78a;
  margin: 1.25em 0; border-radius: 8px; overflow: hidden; background: #151820; color: var(--kirari-text);
  font-size: 0.875rem; text-align: left;
}
.wp-block-code > .np-code { margin: 0; }
.np-code-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.45rem 0.6rem 0.45rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font: 500 0.75rem/1.4 ui-sans-serif, system-ui, sans-serif; color: #949cab; }
.np-code-title { margin-right: auto; color: #dce1ea; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.np-code-header > :first-child:not(.np-code-title) { margin-left: auto; }
.np-code-copy { appearance: none; background: transparent; color: inherit; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 6px; padding: 0.15rem 0.55rem; font: inherit; cursor: pointer; }
.np-code-copy:hover { color: #dce1ea; background: rgba(255, 255, 255, 0.08); }
.np-code-copy:focus-visible { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: 2px; }
.np-code-pre { margin: 0; padding: 0.875rem 1rem; overflow-x: auto; background: transparent; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: inherit; line-height: 1.65; tab-size: 2; white-space: pre; }
.np-code[data-wrap] .np-code-pre { white-space: pre-wrap; word-break: break-word; }
.np-code .kirari-line { display: inline-block; min-width: 100%; }
.np-code[data-line-numbers] .kirari-line::before { content: attr(data-line); display: inline-block; width: 2.5ch; margin-right: 1.25ch; text-align: right; color: #5f6675; user-select: none; }
.np-code .kirari-line-highlighted { background: rgba(157, 189, 255, 0.12); box-shadow: inset 2px 0 0 #9dbdff; }
/* Diff code (\`\`\`diff): the whole added or removed line is tinted, not only its text. */
.np-code .kirari-line:has(> .kirari-inserted) { background: rgba(169, 217, 148, 0.12); box-shadow: inset 2px 0 0 #a9d994; }
.np-code .kirari-line:has(> .kirari-deleted) { background: rgba(242, 160, 169, 0.12); box-shadow: inset 2px 0 0 #f2a0a9; }
/* Long code shows its first 14 lines; the "Show all" checkbox opens the rest with no script. */
.np-code[data-folds] .np-code-pre { max-height: calc(14 * 1.65em + 1.75rem); overflow-y: hidden; -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 3rem), transparent); }
.np-code[data-folds]:has(.np-code-fold-input:checked) .np-code-pre { max-height: none; -webkit-mask-image: none; mask-image: none; }
.np-code-fold { display: flex; justify-content: center; padding: 0.45rem; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.np-code-fold-button { position: relative; cursor: pointer; font: 500 0.75rem/1.4 ui-sans-serif, system-ui, sans-serif; color: #c9d0dc; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 6px; padding: 0.2rem 0.7rem; }
.np-code-fold-button:hover { color: #dce1ea; background: rgba(255, 255, 255, 0.08); }
.np-code-fold-button:has(:focus-visible) { outline: 2px solid var(--npb-accent, #2563eb); outline-offset: 2px; }
.np-code-fold-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.np-code-fold-less { display: none; }
.np-code:has(.np-code-fold-input:checked) .np-code-fold-more { display: none; }
.np-code:has(.np-code-fold-input:checked) .np-code-fold-less { display: inline; }
.kirari-keyword { color: var(--kirari-keyword); } .kirari-variable { color: var(--kirari-variable); }
.kirari-property { color: var(--kirari-property); } .kirari-function { color: var(--kirari-function); }
.kirari-string { color: var(--kirari-string); } .kirari-number { color: var(--kirari-number); }
.kirari-boolean { color: var(--kirari-boolean); } .kirari-null { color: var(--kirari-null); }
.kirari-comment { color: var(--kirari-comment); font-style: italic; } .kirari-operator { color: var(--kirari-operator); }
.kirari-punctuation { color: var(--kirari-punctuation); } .kirari-type { color: var(--kirari-type); }
.kirari-regex { color: var(--kirari-regex); } .kirari-inserted { color: var(--kirari-inserted); }
.kirari-deleted { color: var(--kirari-deleted); } .kirari-heading { color: var(--kirari-heading); font-weight: 600; }
.kirari-tag { color: var(--kirari-tag); } .kirari-attribute { color: var(--kirari-attribute); }
.kirari-entity { color: var(--kirari-entity); }

/* ── Diagrams (Pele) ────────────────────────────────────────── */
.np-diagram {
  --pele-bg: transparent; --pele-fg: var(--npb-text-primary, #18181b); --pele-muted: var(--npb-text-muted, #71717a);
  --pele-line: var(--npb-text-secondary, #52525b); --pele-surface: var(--npb-surface-raised, #f9fafb);
  --pele-surface-alt: var(--npb-surface-inset, #f4f4f5); --pele-border: var(--npb-border-default, #d4d4d8); --pele-accent: var(--npb-accent, #2563eb);
  margin: 1.25em 0; overflow-x: auto; text-align: center;
}
.np-diagram svg { max-width: 100%; height: auto; }
.np-diagram figcaption { margin-top: 0.5rem; font-size: 0.875rem; line-height: 1.5; color: var(--npb-text-secondary, #52525b); }
.np-diagram-loading { min-height: 4rem; }
.np-diagram-error { text-align: left; padding: 0.75rem 1rem; border: 1px dashed var(--npb-border-default, #d4d4d8); border-radius: 8px; color: var(--npb-text-secondary, #52525b); }
.np-diagram-error pre { margin: 0.5rem 0 0; white-space: pre-wrap; font-size: 0.85em; }

/* ── Callout ────────────────────────────────────────────────── */
.np-callout { --np-callout: #3b82f6; display: flex; gap: 0.75rem; margin: 1.25em 0; padding: 0.875rem 1rem; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--np-callout) 35%, transparent); background: color-mix(in srgb, var(--np-callout) 9%, transparent); }
.np-callout[data-type="tip"] { --np-callout: #10b981; }
.np-callout[data-type="warning"] { --np-callout: #f59e0b; }
.np-callout[data-type="danger"] { --np-callout: #ef4444; }
.np-callout[data-type="success"] { --np-callout: #22c55e; }
.np-callout-icon { flex: none; width: 1.25rem; height: 1.25rem; margin-top: 0.15rem; fill: none; stroke: var(--np-callout); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.np-callout-body { min-width: 0; flex: 1; }
.np-callout-body > :where(:first-child, .np-visually-hidden + *) { margin-top: 0; }
.np-callout-body > :last-child { margin-bottom: 0; }
.np-callout-title { font-weight: 600; margin: 0 0 0.35em; }
.np-callout-title + * { margin-top: 0; }
`;
