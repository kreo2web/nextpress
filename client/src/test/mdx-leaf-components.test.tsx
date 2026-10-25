import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { MarkdownView } from '@shared/markdown/markdown-view';

const mdx = (text: string): string => renderToStaticMarkup(<MarkdownView text={text} mdx />);

const block = (name: string, data: Record<string, unknown>, children: BlockConfig[] = []): BlockConfig => ({
  id: 'b1',
  name,
  type: children.length > 0 ? 'container' : 'block',
  parentId: null,
  label: name,
  category: 'advanced',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
  children,
});

const published = (value: BlockConfig): string => {
  const Component = getBlockComponent(value.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...value} />);
};

/** The first element matching `selector` in some markup, as text: what the two ways in must agree on. */
const pick = (markup: string, selector: string): string => {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  return holder.querySelector(selector)?.outerHTML ?? '';
};

const text = (value: BlockConfig['content'] | string): BlockConfig['content'] => ({ kind: 'text', value: String(value) });
const paragraph = (value: string): BlockConfig => ({
  id: 'p1', name: 'core/paragraph', type: 'block', parentId: 'b1', label: 'Paragraph', category: 'basic', content: text(value), styles: {}, settings: {},
});

describe('callout in MDX', () => {
  it('has the same box, icon and title as the block', () => {
    const fromBlock = published(block('docs/callout', { type: 'warning', title: 'Careful' }, [paragraph('Mind the gap.')]));
    const fromMdx = mdx('<Callout type="warning" title="Careful">\nMind the gap.\n</Callout>');
    const strip = (markup: string) => pick(markup, 'aside.np-callout').replace(/<p[^>]*>Mind the gap\.<\/p>|Mind the gap\./g, '');
    expect(strip(fromMdx).replace(/<p>\s*<\/p>/g, '')).toContain('data-type="warning"');
    expect(pick(fromMdx, '.np-callout-icon')).toBe(pick(fromBlock, '.np-callout-icon'));
    expect(pick(fromMdx, '.np-callout-title')).toBe(pick(fromBlock, '.np-callout-title'));
    expect(pick(fromMdx, 'aside').split('>')[0]).toBe(pick(fromBlock, 'aside').split('>')[0]);
  });

  it.each([
    ['Note', 'note'],
    ['Tip', 'tip'],
    ['Warning', 'warning'],
    ['Danger', 'danger'],
    ['Info', 'note'],
    ['Check', 'success'],
  ])('<%s> is a callout of type %s', (tag, type) => {
    const out = mdx(`<${tag} title="Hi">Body</${tag}>`);
    expect(out).toContain(`data-type="${type}"`);
    expect(out).toContain('<p class="np-callout-title">Hi</p>');
  });
});

describe('file tree in MDX', () => {
  const tree = 'src/\n  app.ts *  # the entry point\nREADME.md';
  const list = '- src/\n  - app.ts *  # the entry point\n- README.md';

  it('draws a markdown list exactly like the block draws the same text', () => {
    const fromMdx = mdx(`<FileTree>\n\n${list}\n\n</FileTree>`);
    expect(pick(fromMdx, '.np-file-tree')).toBe(pick(published(block('docs/file-tree', { tree })), '.np-file-tree'));
  });

  it('reads a whole-line bold name as a highlight and a folder with items as a folder', () => {
    const out = mdx('<FileTree>\n\n- src\n  - **app.ts**\n\n</FileTree>');
    expect(out).toContain('data-kind="folder"');
    expect(out).toMatch(/data-highlight=""/);
  });
});

describe('param in MDX', () => {
  it('draws one item like the block does', () => {
    const fromBlock = published(
      block('docs/params', { items: [{ name: 'limit', type: 'number', default: '20', required: false, description: 'How many.' }] }),
    );
    const fromMdx = mdx('<Param name="limit" type="number" default="20">\n\nHow many.\n\n</Param>');
    const head = (markup: string) => pick(markup, '.np-param-head');
    expect(head(fromMdx)).toBe(head(fromBlock));
    expect(pick(fromMdx, '.np-param-body')).toContain('How many.');
  });

  it('shows Required for required and for a literal true', () => {
    expect(mdx('<Param name="id" required>x</Param>')).toContain('Required');
    expect(mdx('<Param name="id" required={true}>x</Param>')).toContain('Required');
    expect(mdx('<Param name="id" required={false} default="1">x</Param>')).toContain('Default: 1');
  });

  it('puts consecutive params side by side in the markup so the styles can join them', () => {
    const out = mdx('<Param name="a">One</Param>\n\n<Param name="b">Two</Param>');
    expect(out.match(/class="np-param"/g)).toHaveLength(2);
    expect(out).toMatch(/<\/div>\s*<div class="np-param">/);
  });
});

describe('example in MDX', () => {
  it('splits the first fenced code from the rest, like the block', () => {
    const out = mdx('<Example>\n\n```js\nconst a = 1\n```\n\nIt makes **a** thing.\n\n</Example>');
    const codePane = pick(out, '.np-example-code');
    const resultPane = pick(out, '.np-example-result');
    expect(codePane).toContain('np-code');
    expect(codePane).not.toContain('It makes');
    expect(resultPane).toContain('<strong>a</strong>');
    expect(out).toContain('data-layout="side"');
    expect(pick(out, '.np-example').startsWith('<div class="np-example" data-layout="side">')).toBe(true);
  });

  it('shows only a result when there is no code', () => {
    const out = mdx('<Example>\n\nJust words.\n\n</Example>');
    expect(out).not.toContain('np-example-code');
    expect(out).toContain('Just words.');
  });
});

describe('kbd and badge in MDX', () => {
  it('draws a key cap inline', () => {
    expect(mdx('Press <Kbd>Ctrl</Kbd> then <Kbd>K</Kbd>.')).toContain('<kbd class="np-kbd">Ctrl</kbd>');
  });

  it('draws the badge pill inline, like the block without its wrapper', () => {
    const fromBlock = published(block('core/badge', { text: 'New', tone: 'success', look: 'outline' }));
    const fromMdx = mdx('Now <Badge tone="success" look="outline">New</Badge> here.');
    expect(pick(fromMdx, '.np-badge')).toBe(pick(fromBlock, '.np-badge'));
    expect(fromMdx).toMatch(/<p>Now <span class="np-badge/);
  });

  it('falls back to the accent soft badge for unknown tone or look', () => {
    expect(mdx('<Badge tone="neon" look="glow">x</Badge>')).toContain('class="np-badge np-badge--soft" data-tone="accent"');
  });
});
