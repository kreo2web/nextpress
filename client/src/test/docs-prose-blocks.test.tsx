import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { getBlockEntry } from '@shared/block-catalog';
import { DOCS_PROSE_CSS } from '@shared/blocks/docs-prose-css';
import { PUBLISH_BLOCK_CSS } from '@shared/publish-block-css';
import { createSlugger, readMarkdownHeadings } from '@shared/markdown/headings';
import { parseMarkdown } from '@shared/markdown/parse-markdown';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { DocsHeadingSettings } from '@/components/PageBuilder/blocks/docs-heading/docs-heading-settings';
import { DocsListSettings } from '@/components/PageBuilder/blocks/docs-list/docs-list-settings';
import { DocsTextSettings } from '@/components/PageBuilder/blocks/docs-text/docs-text-settings';

const { buildBlockLibraryCategories } = await import('@/components/PageBuilder/BlockLibrary');

const stubActions: BlockActionsContextValue = {
  selectedBlockId: null,
  editingBlockId: null,
  hoveredBlockId: null,
  onSelect: () => {},
  onStartEditing: () => {},
  onStopEditing: () => {},
  onHoverBlock: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
  hoverHighlight: null,
};

const block = (name: string, data: Record<string, unknown>): BlockConfig => ({
  id: 'b1',
  name,
  type: 'block',
  parentId: null,
  label: name,
  category: 'docs',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
});

const forSettings = (value: BlockConfig): BlockConfig => ({ ...value, id: 'settings-only' });
const heading = (level: number, text: string) => block('docs/heading', { level, text });
const text = (value: string) => block('docs/text', { text: value });
const list = (style: string, items: unknown[]) => block('docs/list', { style, items });

const html = (value: BlockConfig): string => {
  const Component = getBlockComponent(value.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...value} />);
};

const renderCanvas = (value: BlockConfig, isEditing = false) => {
  const Component = blockRegistry[value.name].component as React.ComponentType<{
    value: BlockConfig;
    onChange: (next: BlockConfig) => void;
    isPreview?: boolean;
    isEditing?: boolean;
  }>;
  return render(
    <BlockActionsProvider value={stubActions}>
      <Component value={value} onChange={() => {}} isPreview={!isEditing} isEditing={isEditing} />
    </BlockActionsProvider>,
  );
};

describe('docs heading block', () => {
  it.each([2, 3, 4])('publishes level %i as the matching tag with the contents-list id and a # link', (level) => {
    const words = 'Install the `CLI` now';
    const out = html(heading(level, words));
    const parsed = parseMarkdown({ text: `## ${words}` });
    if (!parsed.ok) throw new Error('parse');
    const id = readMarkdownHeadings(parsed.tree, createSlugger())[0].id;
    expect(out).toContain(`<h${level} id="${id}" class="np-doc-heading">`);
    expect(out).toContain(`<a class="np-heading-anchor" href="#${id}" aria-label="Link to this section">#</a>`);
    expect(out).toContain('<code class="np-inline-code">CLI</code>');
    expect(out).toMatch(/class="wp-block-docs-heading np-prose[^"]*"/);
  });

  it('uses a typed link id instead of the one made from the text', () => {
    const out = html(block('docs/heading', { level: 3, text: 'Install', anchor: 'start here' }));
    expect(out).toContain('<h3 id="start-here"');
    expect(out).toContain('href="#start-here"');
  });

  it('shows a level outside 2 to 4 as a level 2', () => {
    expect(html(heading(1, 'Title'))).toContain('<h2 id="title"');
  });

  it('draws the same heading on the canvas, and settings change level and text', () => {
    const { container } = renderCanvas(heading(3, 'Hello there'));
    expect(container.querySelector('h3#hello-there')).not.toBeNull();
    const onUpdate = vi.fn();
    render(<DocsHeadingSettings block={forSettings(heading(2, 'A'))} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: 'H4' }));
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"level":4');
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'New ' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"text":"New "');
    fireEvent.change(screen.getByLabelText('Link id'), { target: { value: 'go' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"anchor":"go"');
  });
});

describe('the # link style', () => {
  const css = DOCS_PROSE_CSS;

  it('is hidden until the heading is hovered or the link has keyboard focus', () => {
    expect(css).toMatch(/\.np-heading-anchor \{[^}]*opacity: 0;/);
    expect(css).toMatch(/\.np-doc-heading:hover \.np-heading-anchor, \.np-heading-anchor:focus-visible \{ opacity: 1; \}/);
  });

  it('is part of the CSS every page and the editor load', () => {
    expect(PUBLISH_BLOCK_CSS).toContain('.np-heading-anchor');
  });

  it('writes the phone rules twice', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@container npb-canvas (max-width: 767px)');
  });
});

describe('docs text block', () => {
  it('publishes bold, italic, code and links in one paragraph with the prose class', () => {
    const out = html(text('A **b** and *i* and `c` and [l](https://example.com/x).'));
    expect(out).toMatch(/<div class="wp-block-docs-text np-prose[^"]*"><p>/);
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('<code class="np-inline-code">c</code>');
    expect(out).toContain('<a href="https://example.com/x">l</a>');
  });

  it('drops an unsafe link address and never injects HTML', () => {
    const out = html(text('[x](javascript:alert(1)) <script>alert(1)</script>'));
    expect(out).not.toContain('href="javascript');
    expect(out).not.toContain('<script>');
  });

  it('edits in place with a text field and in settings', () => {
    const { container } = renderCanvas(text('Hi **there**'), true);
    expect(container.querySelector('textarea')).toHaveValue('Hi **there**');
    const onUpdate = vi.fn();
    render(<DocsTextSettings block={forSettings(text('a'))} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'a *b*' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"text":"a *b*"');
  });
});

describe('docs list block', () => {
  const items = [
    { text: 'one', checked: true, children: [{ text: 'sub **x**', checked: false }] },
    { text: 'two', checked: false, children: [] },
    { text: '   ', checked: false, children: [] },
  ];

  it('publishes bullets and numbers with one nested level, skipping empty rows', () => {
    const bullets = html(list('bullet', items));
    expect(bullets).toContain('<ul><li>one<ul><li>sub <strong>x</strong></li></ul></li><li>two</li></ul>');
    expect(html(list('number', items))).toContain('<ol><li>one<ol>');
  });

  it('publishes a checklist with read-only boxes', () => {
    const out = html(list('check', items));
    expect(out).toContain('class="np-doc-checklist"');
    expect(out).toContain('<input type="checkbox" disabled="" readOnly="" aria-label="Done" checked=""/>one');
    expect(out.match(/type="checkbox"/g)).toHaveLength(3);
  });

  it('settings turn the lines into items and switch the style', () => {
    const onUpdate = vi.fn();
    render(<DocsListSettings block={forSettings(list('bullet', items))} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText(/Items/), { target: { value: 'a\n  b\nc' } });
    const saved = onUpdate.mock.calls.at(-1)?.[0].content.data.items;
    expect(saved).toEqual([
      { text: 'a', checked: false, children: [{ text: 'b', checked: false }] },
      { text: 'c', checked: false, children: [] },
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'Checklist' }));
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.style).toBe('check');
  });

  it('draws the same list on the canvas', () => {
    const { container } = renderCanvas(list('number', items));
    expect(container.querySelectorAll('ol > li')).toHaveLength(3);
    expect(container.querySelector('ol ol li')).not.toBeNull();
  });
});

describe('catalog and block library', () => {
  const NAMES = ['docs/heading', 'docs/text', 'docs/list'] as const;

  it.each(NAMES)('%s is in the docs category with an agent note', (name) => {
    const entry = getBlockEntry(name);
    expect(entry.category).toBe('docs');
    expect(entry.agentNote.length).toBeGreaterThan(40);
    expect(blockRegistry[name]).toBeDefined();
    expect(getBlockComponent(name)).toBeTruthy();
  });

  it('the docs editor offers them, and the page builder does not', () => {
    const docsEditor = buildBlockLibraryCategories({ mode: 'docs' }).flatMap((group) => group.blocks.map((item) => item.id));
    expect(docsEditor).toEqual(expect.arrayContaining([...NAMES]));
    const pageBuilder = buildBlockLibraryCategories().flatMap((group) => group.blocks.map((item) => item.id));
    NAMES.forEach((name) => expect(pageBuilder).not.toContain(name));
  });
});
