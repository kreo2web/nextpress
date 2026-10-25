import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { tabElementIds } from '@shared/blocks/tabs-model';
import { CODE_GROUP_CSS } from '@shared/blocks/code-group-css';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { CodeGroupSettings } from '@/components/PageBuilder/blocks/code-group/code-group-settings';

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

const code = (id: string, source: string, title: string, language = 'shell'): BlockConfig => ({
  id, name: 'core/code', type: 'block', parentId: 'cg1', label: 'Code', category: 'advanced',
  content: { kind: 'structured', data: { content: source, language, title } }, styles: {}, settings: {},
});

const group = (data: Record<string, boolean> = {}, extra: BlockConfig[] = []): BlockConfig => ({
  id: 'cg1', name: 'docs/code-group', type: 'container', parentId: null, label: 'Code group', category: 'docs',
  content: { kind: 'structured', data }, styles: {}, settings: {},
  children: [code('k1', 'npm install x', 'npm'), code('k2', 'pnpm add x', '', 'typescript'), ...extra],
});

const html = (block: BlockConfig): string => {
  const Component = getBlockComponent(block.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...block} />);
};

type CanvasProps = { value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean };
const renderCanvas = (selectedBlockId: string | null, block = group()) => {
  const Component = blockRegistry['docs/code-group'].component as React.ComponentType<CanvasProps>;
  const ui = (id: string | null) => (
    <BlockActionsProvider value={{ ...stubActions, selectedBlockId: id }}>
      <Component value={block} onChange={() => {}} isPreview />
    </BlockActionsProvider>
  );
  const view = render(ui(selectedBlockId));
  return { ...view, select: (id: string | null) => view.rerender(ui(id)) };
};

describe('published code group', () => {
  it('is tabs markup with np-code-group, the names as data-np-sync and the code in the panels', () => {
    const out = html(group());
    const first = tabElementIds({ tabsId: 'cg1', index: 0 });
    const second = tabElementIds({ tabsId: 'cg1', index: 1 });
    expect(out).toMatch(/class="wp-block-tabs np-tabs--underline np-code-group[ "]/);
    expect(out).toContain('data-np-tabs');
    expect(out).toContain('role="tablist" data-np-sync="npm|TypeScript" data-np-remember="true"');
    expect(out).toMatch(new RegExp(`<button[^>]*id="${first.tab}"[^>]*aria-selected="true"[^>]*>npm</button>`));
    expect(out).toMatch(new RegExp(`<button[^>]*id="${second.tab}"[^>]*aria-selected="false"[^>]*>TypeScript</button>`));
    expect(out).toMatch(new RegExp(`id="${second.panel}"[^>]*hidden`));
    expect(out).not.toMatch(new RegExp(`id="${first.panel}"[^>]*hidden`));
    expect(out).toContain('np-code');
  });

  it('turns remembering off with the switch', () => {
    expect(html(group({ remember: false }))).toContain('data-np-remember="false"');
  });

  it('shows a block that is not code after the panels', () => {
    const note: BlockConfig = {
      id: 'n1', name: 'core/paragraph', type: 'block', parentId: 'cg1', label: 'Paragraph', category: 'basic',
      content: { kind: 'text', value: 'A note' }, styles: {}, settings: {},
    };
    const out = html(group({}, [note]));
    expect(out.indexOf('A note')).toBeGreaterThan(out.lastIndexOf('role="tabpanel"'));
    expect(out).toContain('data-np-sync="npm|TypeScript"');
  });

  it('writes the phone rules twice (page and editor preview)', () => {
    expect(CODE_GROUP_CSS).toContain('@media (max-width: 767px)');
    expect(CODE_GROUP_CSS).toContain('@container npb-canvas (max-width: 767px)');
  });
});

describe('code group on the canvas', () => {
  it('shows only the open code and switches on click', () => {
    renderCanvas(null);
    expect(screen.getByRole('tab', { name: 'npm' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'TypeScript' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'TypeScript' }));
    expect(screen.getByRole('tab', { name: 'TypeScript' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'npm' })).toHaveAttribute('aria-selected', 'false');
  });

  it('hides the closed code with display none', () => {
    const { container } = renderCanvas(null);
    const hidden = Array.from(container.querySelectorAll<HTMLElement>('.np-tabs__panels > *')).filter((el) => el.style.display === 'none');
    expect(hidden).toHaveLength(1);
  });

  it('opens a hidden tab when its code gets selected', () => {
    const { select } = renderCanvas(null);
    select('k2');
    expect(screen.getByRole('tab', { name: 'TypeScript' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('code group settings', () => {
  it('adds a code block titled for the next tab, inside the group', () => {
    const onUpdate = vi.fn();
    render(<CodeGroupSettings block={group()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Add code/ }));
    const children = onUpdate.mock.calls[0][0].children as BlockConfig[];
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ name: 'core/code', parentId: 'cg1', content: { data: { title: 'Tab 3' } } });
  });

  it('turns remembering off', () => {
    const onUpdate = vi.fn();
    render(<CodeGroupSettings block={group()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('switch', { name: /Remember the reader/ }));
    expect(JSON.stringify(onUpdate.mock.calls)).toContain('"remember":false');
  });

  it('says where the tab names come from', () => {
    render(<CodeGroupSettings block={group()} onUpdate={() => {}} />);
    expect(screen.getByText(/named by its code block's title/)).toBeInTheDocument();
  });
});
