import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { MarkdownView } from '@shared/markdown';
import { safeHref } from '@shared/markdown/safe-href';
import { remarkDocComponentIds } from '@shared/markdown/doc-component-ids';
import { blockNeedsTabsScript } from '@shared/blocks/tabs-script';

const block = (id: string, name: string, data: Record<string, string | number | boolean>, children: BlockConfig[] = [], parentId: string | null = null): BlockConfig => ({
  id, name, type: 'container', parentId, label: name, category: 'layout',
  content: { kind: 'structured', data }, styles: {}, settings: {}, children,
});
const paragraph = (id: string, value: string, parentId: string): BlockConfig => ({
  id, name: 'core/paragraph', type: 'block', parentId, label: 'Paragraph', category: 'basic',
  content: { kind: 'text', value }, styles: {}, settings: {},
});
const code = (id: string, title: string, language: string, parentId: string): BlockConfig => ({
  id, name: 'core/code', type: 'block', parentId, label: 'Code', category: 'advanced',
  content: { kind: 'structured', data: { content: 'npm i', language, title } }, styles: {}, settings: {},
});

const published = (b: BlockConfig): string => {
  const Component = getBlockComponent(b.name);
  if (!Component) throw new Error(`No renderer for ${b.name}`);
  return renderToStaticMarkup(<Component {...b} />);
};
const mdx = (text: string, idPrefix = 'blk'): string => renderToStaticMarkup(<MarkdownView text={text} mdx idPrefix={idPrefix} />);

const LOOK_CLASS = /^(wp-block-(tabs|tab|steps|step|grid|card)|np-(tabs|steps|step|grid|card|accordion|code-group)(__|-|$).*)$/;
/** The structure that styles it: each element's tag and look classes (the part of the markup the shared CSS reads), in order. */
const skeleton = (html: string): string[] => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return Array.from(root.querySelectorAll('*')).flatMap((el) => {
    const classes = Array.from(el.classList).filter((name) => LOOK_CLASS.test(name) && name !== 'np-accordion--doc' && name !== 'wp-block-accordion').sort();
    const role = el.getAttribute('role');
    return classes.length > 0 ? [`${el.tagName.toLowerCase()}.${classes.join('.')}${role ? `[${role}]` : ''}`] : [];
  });
};

describe('MDX containers draw the same structure as their blocks', () => {
  it('Tabs / Tab', () => {
    const blockHtml = published(block('t1', 'core/tabs', { look: 'underline' }, [
      block('a', 'core/tab', { title: 'One' }, [paragraph('p1', 'first', 'a')], 't1'),
      block('b', 'core/tab', { title: 'Two' }, [paragraph('p2', 'second', 'b')], 't1'),
    ]));
    const mdxHtml = mdx('<Tabs>\n<Tab title="One">\nfirst\n</Tab>\n<Tab title="Two">\nsecond\n</Tab>\n</Tabs>');
    expect(skeleton(mdxHtml)).toEqual(skeleton(blockHtml));
    expect(mdxHtml).toContain('data-np-tabs=""');
    expect(mdxHtml).toMatch(/role="tabpanel"[^>]*hidden/);
  });

  it('Steps / Step', () => {
    const blockHtml = published(block('s1', 'core/steps', { layout: 'vertical', marker: 'number' }, [
      block('x', 'core/step', { title: 'Install' }, [paragraph('p1', 'run it', 'x')], 's1'),
      block('y', 'core/step', { title: 'Use' }, [paragraph('p2', 'use it', 'y')], 's1'),
    ]));
    const mdxHtml = mdx('<Steps>\n<Step title="Install">\nrun it\n</Step>\n<Step title="Use">\nuse it\n</Step>\n</Steps>');
    expect(skeleton(mdxHtml)).toEqual(skeleton(blockHtml));
    expect(mdxHtml).toContain('<h3 class="np-step__title">Install</h3>');
  });

  it('Cards / Card with a link', () => {
    const blockHtml = published(block('g1', 'core/grid', { columns: 2, phoneColumns: 1 }, [
      block('c1', 'core/card', { title: 'Alpha', look: 'bordered', link: 'https://example.com/', linkLabel: 'Alpha' }, [paragraph('p1', 'text', 'c1')], 'g1'),
    ]));
    const mdxHtml = mdx('<Cards cols="2">\n<Card title="Alpha" href="https://example.com/">\ntext\n</Card>\n</Cards>');
    expect(skeleton(mdxHtml)).toEqual(skeleton(blockHtml));
    expect(mdxHtml).toContain('--np-grid-cols:2');
    expect(mdxHtml).toContain('<h3');
    expect(mdxHtml).toContain('href="https://example.com/"');
    expect(mdxHtml).toContain('aria-label="Alpha"');
  });

  it('Cards clamps cols to 1-4 and defaults to 2', () => {
    expect(mdx('<Cards cols="9"><Card title="A">x</Card></Cards>')).toContain('--np-grid-cols:4');
    expect(mdx('<Cards cols="0"><Card title="A">x</Card></Cards>')).toContain('--np-grid-cols:2');
    expect(mdx('<Cards><Card title="A">x</Card></Cards>')).toContain('--np-grid-cols:2');
  });

  it('a Card drops an unsafe href', () => {
    const html = mdx('<Cards><Card title="A" href="javascript:alert(1)">x</Card></Cards>');
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('np-card__link');
  });

  it('Accordion is a native details with the block classes', () => {
    const blockHtml = published(block('ac', 'core/accordion', { firstOpen: false }, [
      block('i1', 'core/accordion-item', { title: 'Question' }, [paragraph('p1', 'answer', 'i1')], 'ac'),
    ]));
    const mdxHtml = mdx('<Accordion title="Question">\nanswer\n</Accordion>');
    const names = (html: string) => {
      const root = document.createElement('div');
      root.innerHTML = html;
      return Array.from(root.querySelectorAll('*')).flatMap((el) => Array.from(el.classList).filter((name) => /^np-accordion__/.test(name))).filter((n) => n !== 'np-accordion__body' || true);
    };
    expect(names(mdxHtml)).toEqual(names(blockHtml));
    expect(mdxHtml).toContain('<details class="np-accordion__item">');
    expect(mdxHtml).toContain('<summary class="np-accordion__title">');
  });

  it('CodeGroup matches the code group block, with labels from title= or the language', () => {
    const blockHtml = published(block('cg', 'docs/code-group', { remember: true }, [
      code('k1', 'npm', 'shell', 'cg'),
      code('k2', '', 'typescript', 'cg'),
    ]));
    const mdxHtml = mdx('<CodeGroup>\n\n```sh title="npm"\nnpm i\n```\n\n```ts\nnpm i\n```\n\n</CodeGroup>');
    expect(skeleton(mdxHtml)).toEqual(skeleton(blockHtml));
    expect(mdxHtml).toContain('data-np-sync="npm|TypeScript"');
    expect(blockHtml).toContain('data-np-sync="npm|TypeScript"');
    expect(mdxHtml).toContain('data-np-remember="true"');
  });

  it('a fence with no title or language is called Code', () => {
    expect(mdx('<CodeGroup>\n\n```\nx\n```\n\n</CodeGroup>')).toContain('data-np-sync="Code"');
  });
});

describe('MDX tab ids', () => {
  const text = '<Tabs>\n<Tab title="A">\na\n</Tab>\n</Tabs>\n\n<CodeGroup>\n\n```ts\nx\n```\n\n</CodeGroup>';
  const idsOf = (html: string): string[] => Array.from(html.matchAll(/ id="(np-tabs-[^"]+)"/g), (m) => m[1]);

  it('are the same on every render', () => {
    expect(mdx(text, 'm1')).toBe(mdx(text, 'm1'));
  });

  it('number Tabs and CodeGroup in reading order and stay unique inside the block', () => {
    const ids = idsOf(mdx(text, 'm1'));
    expect(ids.some((id) => id.startsWith('np-tabs-m1-md-1-'))).toBe(true);
    expect(ids.some((id) => id.startsWith('np-tabs-m1-md-2-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('are unique across two markdown blocks on one page', () => {
    const ids = [...idsOf(mdx(text, 'first')), ...idsOf(mdx(text, 'second'))];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can not be chosen by the author', () => {
    const html = mdx('<Tabs index="99">\n<Tab title="A">\na\n</Tab>\n</Tabs>', 'm1');
    expect(html).toContain('np-tabs-m1-md-1-tab-0');
    expect(html).not.toContain('md-99');
  });

  it('the numbering step sets index on tagged nodes only', () => {
    const tree = { children: [{ data: { hName: 'np-tabs', hProperties: {} } }, { data: { hName: 'np-tab' } }, { data: { hName: 'np-codegroup', hProperties: {} } }] };
    remarkDocComponentIds()(tree);
    expect(tree.children[0].data).toMatchObject({ hProperties: { index: '1' } });
    expect(tree.children[1].data).toEqual({ hName: 'np-tab' });
    expect(tree.children[2].data).toMatchObject({ hProperties: { index: '2' } });
  });
});

describe('MDX tabs in React (editor, chat)', () => {
  it('switch with state', () => {
    const { container } = render(<MarkdownView text={'<Tabs>\n<Tab title="One">\nfirst\n</Tab>\n<Tab title="Two">\nsecond\n</Tab>\n</Tabs>'} mdx idPrefix="r1" />);
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = () => Array.from(container.querySelectorAll<HTMLElement>('[role="tabpanel"]')).map((p) => p.hidden);
    expect(panels()).toEqual([false, true]);
    fireEvent.click(tabs[1]);
    expect(panels()).toEqual([true, false]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    expect(panels()).toEqual([false, true]);
  });
});

describe('safeHref', () => {
  it('keeps https, http, mailto, relative paths and anchors', () => {
    for (const href of ['https://a.dev/x', 'http://a.dev', 'mailto:me@a.dev', '/docs/start', './x', '../x', '#top', 'docs/start']) {
      expect(safeHref(href)).toBe(href);
    }
  });

  it('drops javascript:, data:, odd spellings and protocol-relative links', () => {
    for (const href of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.dev', '', undefined]) {
      expect(safeHref(href)).toBe('');
    }
  });
});

describe('when /vendor/tabs.js loads', () => {
  const md = (data: Record<string, string | boolean>): BlockConfig => block('m', 'core/markdown', data);

  it('loads for the Tabs and Code group blocks', () => {
    expect(blockNeedsTabsScript(block('a', 'core/tabs', {}))).toBe(true);
    expect(blockNeedsTabsScript(block('b', 'docs/code-group', {}))).toBe(true);
  });

  it('loads for MDX markdown that uses <Tabs> or <CodeGroup>', () => {
    expect(blockNeedsTabsScript(md({ mdx: true, content: 'hi\n\n<Tabs>\n</Tabs>' }))).toBe(true);
    expect(blockNeedsTabsScript(md({ mdx: true, content: '<CodeGroup>\n</CodeGroup>' }))).toBe(true);
  });

  it('stays off for plain markdown, MDX without them, and other blocks', () => {
    expect(blockNeedsTabsScript(md({ mdx: false, content: '<Tabs>' }))).toBe(false);
    expect(blockNeedsTabsScript(md({ mdx: true, content: '<Callout type="tip">x</Callout> <TabsLike>' }))).toBe(false);
    expect(blockNeedsTabsScript(block('p', 'core/paragraph', {}))).toBe(false);
  });
});

describe('docs tags written on back-to-back lines', () => {
  it('still finds every tab, card and parameter', () => {
    const tabs = mdx('<Tabs>\n<Tab title="Mac">Use Homebrew.</Tab>\n<Tab title="Linux">Use apt.</Tab>\n</Tabs>');
    expect(tabs.match(/role="tab"/g)).toHaveLength(2);
    expect(tabs).not.toMatch(/<p[^>]*>\s*<div class="wp-block-tab/);

    const cards = mdx('<Cards cols="2">\n<Card title="A">One.</Card>\n<Card title="B">Two.</Card>\n</Cards>');
    const items = cards.slice(cards.indexOf('np-grid__items'));
    expect(items).not.toMatch(/np-grid__items">\s*<p/);

    const params = mdx('<Param name="a" type="string">First.</Param>\n<Param name="b" type="number">Second.</Param>');
    expect(params).not.toMatch(/<p[^>]*>\s*<div/);
  });

  it('keeps a line of text with inline tags as a paragraph', () => {
    expect(mdx('Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>.')).toMatch(/<p[^>]*>Press <kbd/);
  });
});
