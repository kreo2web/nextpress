import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { CALLOUT_CSS } from '@shared/blocks/callout-css';
import { CODE_EXAMPLE_CSS } from '@shared/blocks/code-example-css';
import { FILE_TREE_CSS } from '@shared/blocks/file-tree-css';
import { PARAMS_CSS } from '@shared/blocks/params-css';
import { MAX_PARAMS } from '@shared/blocks/params-model';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { CalloutSettings } from '@/components/PageBuilder/blocks/callout/callout-settings';
import { CodeExampleSettings } from '@/components/PageBuilder/blocks/code-example/code-example-settings';
import { FileTreeSettings } from '@/components/PageBuilder/blocks/file-tree/file-tree-settings';
import { ParamsSettings } from '@/components/PageBuilder/blocks/params/params-settings';

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

const child = (id: string, parentId: string, name: string, content: BlockConfig['content']): BlockConfig => ({
  id,
  name,
  type: 'block',
  parentId,
  label: name,
  category: 'basic',
  content,
  styles: {},
  settings: {},
});

const paragraph = (id: string, text: string, parentId: string) => child(id, parentId, 'core/paragraph', { kind: 'text', value: text });
const code = (id: string, source: string, parentId: string) =>
  child(id, parentId, 'core/code', { kind: 'structured', data: { content: source, language: 'js', title: '' } });

const block = (id: string, name: string, data: Record<string, unknown>, children: BlockConfig[] = []): BlockConfig => ({
  id,
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

const html = (value: BlockConfig): string => {
  const Component = getBlockComponent(value.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...value} />);
};

const renderCanvas = (value: BlockConfig) => {
  const Component = blockRegistry[value.name].component as React.ComponentType<{
    value: BlockConfig;
    onChange: (next: BlockConfig) => void;
    isPreview?: boolean;
  }>;
  return render(
    <BlockActionsProvider value={stubActions}>
      <Component value={value} onChange={() => {}} isPreview />
    </BlockActionsProvider>,
  );
};

const phoneRulesTwice = (css: string) => {
  expect(css).toContain('@media (max-width: 767px)');
  expect(css).toContain('@container npb-canvas (max-width: 767px)');
  expect(css).toContain('.npb-canvas-page');
};

const callout = (data: Record<string, unknown> = {}) =>
  block('c1', 'docs/callout', data, [paragraph('c1-p', 'Back up first.', 'c1')]);

describe('callout block', () => {
  it('publishes the shared callout with its blocks inside the body', () => {
    const out = html(callout({ type: 'warning', title: 'Careful' }));
    expect(out).toContain('wp-block-callout');
    expect(out).toContain('<aside class="np-callout" data-type="warning">');
    expect(out).toContain('<p class="np-callout-title">Careful</p>');
    expect(out).toContain('Back up first.');
  });

  it('shows an unknown type as a note and leaves out an empty title', () => {
    const out = html(callout({ type: 'loud' }));
    expect(out).toContain('data-type="note"');
    expect(out).not.toContain('np-callout-title');
  });

  it('draws the same callout on the canvas, with the child block inside', () => {
    const { container } = renderCanvas(callout({ type: 'tip', title: 'Hint' }));
    const aside = container.querySelector('aside.np-callout');
    expect(aside).toHaveAttribute('data-type', 'tip');
    expect(within(aside as HTMLElement).getByText('Hint')).toBeInTheDocument();
    expect(within(aside as HTMLElement).getByText('Back up first.')).toBeInTheDocument();
  });

  it('settings change the type and keep spaces typed in the title', () => {
    const onUpdate = vi.fn();
    render(<CalloutSettings block={callout()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Danger' }));
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"type":"danger"');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Back up ' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"title":"Back up "');
  });

  it('writes the phone rules twice', () => phoneRulesTwice(CALLOUT_CSS));
});

const fileTree = (tree: string) => block('f1', 'docs/file-tree', { tree });

describe('file tree block', () => {
  const tree = 'src/\n  app.ts * # the entry point\nREADME.md';

  it('publishes a nested list with folders, highlights and notes', () => {
    const out = html(fileTree(tree));
    expect(out).toContain('wp-block-file-tree');
    expect(out).toContain('<div class="np-file-tree">');
    expect(out).toMatch(/<li class="np-file-tree-item" data-kind="folder">.*Folder: <\/span><span class="np-file-tree-name">src<\/span>/);
    expect(out).toMatch(/data-highlight=""[^>]*>.*<span class="np-file-tree-name">app\.ts<\/span>/);
    expect(out).toContain('<span class="np-file-tree-note">the entry point</span>');
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain('role="tree"');
  });

  it('draws the same list on the canvas', () => {
    const { container } = renderCanvas(fileTree(tree));
    expect(container.querySelectorAll('li.np-file-tree-item')).toHaveLength(3);
    expect(container.querySelector('ul ul')).not.toBeNull();
  });

  it('settings edit the text and explain the syntax', () => {
    const onUpdate = vi.fn();
    render(<FileTreeSettings block={fileTree(tree)} onUpdate={onUpdate} />);
    expect(screen.getByText(/Indent two spaces/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tree'), { target: { value: 'a/\n  b' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('a/\\n  b');
  });

  it('writes the phone rules twice', () => phoneRulesTwice(FILE_TREE_CSS));
});

const items = [
  { name: 'siteId', type: 'string', default: '', required: true, description: 'The **site** to read.' },
  { name: 'limit', type: 'number', default: '20', required: false, description: '' },
];
const params = (list: unknown[] = items) => block('p1', 'docs/params', { items: list });

describe('parameters block', () => {
  it('publishes each item with its type, Required or default, and a small markdown description', () => {
    const out = html(params());
    expect(out).toContain('wp-block-params');
    expect(out).toContain('<code class="np-param-name">siteId</code>');
    expect(out).toContain('<span class="np-param-type">string</span>');
    expect(out).toContain('<span class="np-param-flag">Required</span>');
    expect(out).toContain('<span class="np-param-default">Default: 20</span>');
    expect(out).toContain('np-prose-compact');
    expect(out).toContain('<strong>site</strong>');
  });

  it('skips a parameter with no name', () => {
    const out = html(params([...items, { name: '  ', type: 'x', default: '', required: false, description: '' }]));
    expect(out.match(/class="np-param"/g)).toHaveLength(2);
  });

  it('draws the same list on the canvas', () => {
    const { container } = renderCanvas(params());
    expect(container.querySelectorAll('.np-param')).toHaveLength(2);
  });

  it('settings add, edit, move and remove parameters', () => {
    const onUpdate = vi.fn();
    render(<ParamsSettings block={params()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Add parameter/ }));
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.items).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Move parameter 2 up' }));
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.items[0].name).toBe('limit');
    fireEvent.click(screen.getByRole('button', { name: 'Remove parameter 1' }));
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.items).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Type', { selector: '#param-type-0' }), { target: { value: 'string | null' } });
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.items[0].type).toBe('string | null');
    fireEvent.click(screen.getAllByRole('switch')[1]);
    expect(onUpdate.mock.calls.at(-1)?.[0].content.data.items[1].required).toBe(true);
  });

  it('stops adding at the limit and says so', () => {
    const many = Array.from({ length: MAX_PARAMS }, (_, index) => ({ name: `p${index}`, type: '', default: '', required: false, description: '' }));
    render(<ParamsSettings block={params(many)} onUpdate={() => {}} />);
    expect(screen.getByRole('button', { name: /Add parameter/ })).toBeDisabled();
    expect(screen.getByText(new RegExp(`up to ${MAX_PARAMS} parameters`))).toBeInTheDocument();
  });

  it('writes the phone rules twice', () => phoneRulesTwice(PARAMS_CSS));
});

const example = (data: Record<string, unknown> = {}) =>
  block('e1', 'docs/example', data, [code('e1-c', 'const a = 1', 'e1'), paragraph('e1-p', 'It makes a thing.', 'e1')]);

describe('code example block', () => {
  it('publishes the first code in a Code pane and the rest in a Result pane', () => {
    const out = html(example({ layout: 'stacked' }));
    expect(out).toContain('data-layout="stacked"');
    const codeAt = out.indexOf('aria-label="Code"');
    const resultAt = out.indexOf('aria-label="Result"');
    expect(codeAt).toBeGreaterThan(-1);
    expect(resultAt).toBeGreaterThan(codeAt);
    expect(out.indexOf('const')).toBeGreaterThan(codeAt);
    expect(out.indexOf('const')).toBeLessThan(resultAt);
    expect(out.indexOf('It makes a thing.')).toBeGreaterThan(resultAt);
  });

  it('defaults to side by side', () => {
    expect(html(example())).toContain('data-layout="side"');
  });

  it('keeps ordinary blocks on the canvas, code first', () => {
    const { container } = renderCanvas(example());
    const stack = container.querySelector('.np-example-stack');
    expect(stack?.children).toHaveLength(2);
    expect(stack?.children[1]).toHaveTextContent('It makes a thing.');
  });

  it('settings pick the layout', () => {
    const onUpdate = vi.fn();
    render(<CodeExampleSettings block={example()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Stacked' }));
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"layout":"stacked"');
  });

  it('writes the phone rules twice and stacks on phones', () => {
    phoneRulesTwice(CODE_EXAMPLE_CSS);
    expect(CODE_EXAMPLE_CSS).toContain('@media (min-width: 768px)');
  });
});
