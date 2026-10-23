import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { tabElementIds } from '@shared/blocks/tabs-model';
import { TABS_CSS } from '@shared/blocks/tabs-css';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { TabsSettings } from '@/components/PageBuilder/blocks/tabs/tabs-settings';
import { TabSettings } from '@/components/PageBuilder/blocks/tabs/tab-settings';

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

const paragraph = (id: string, text: string, parentId: string): BlockConfig => ({
  id,
  name: 'core/paragraph',
  type: 'block',
  parentId,
  label: 'Paragraph',
  category: 'basic',
  content: { kind: 'text', value: text },
  styles: {},
  settings: {},
});

const tab = (id: string, title: string, text: string): BlockConfig => ({
  id,
  name: 'core/tab',
  type: 'container',
  parentId: 'tabs1',
  label: 'Tab',
  category: 'layout',
  content: { kind: 'structured', data: { title } },
  styles: {},
  settings: {},
  children: [paragraph(`${id}-p`, text, id)],
});

const tabs = (data: Record<string, string> = {}): BlockConfig => ({
  id: 'tabs1',
  name: 'core/tabs',
  type: 'container',
  parentId: null,
  label: 'Tabs',
  category: 'layout',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
  children: [tab('t1', 'npm', 'npm install'), tab('t2', 'pnpm', 'pnpm add')],
});

type CanvasProps = { value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean };
const TabsCanvas = () => blockRegistry['core/tabs'].component as React.ComponentType<CanvasProps>;

const renderCanvas = (selectedBlockId: string | null, block = tabs()) => {
  const Component = TabsCanvas();
  const ui = (id: string | null) => (
    <BlockActionsProvider value={{ ...stubActions, selectedBlockId: id }}>
      <Component value={block} onChange={() => {}} isPreview />
    </BlockActionsProvider>
  );
  const view = render(ui(selectedBlockId));
  return { ...view, select: (id: string | null) => view.rerender(ui(id)) };
};

describe('published tabs', () => {
  const html = (block: BlockConfig): string => {
    const Component = getBlockComponent(block.name);
    if (!Component) throw new Error('missing renderer');
    return renderToStaticMarkup(<Component {...block} />);
  };

  it('draws a tab list and panels tied together, with only the first open', () => {
    const out = html(tabs({ look: 'pills' }));
    const first = tabElementIds({ tabsId: 'tabs1', index: 0 });
    const second = tabElementIds({ tabsId: 'tabs1', index: 1 });
    expect(out).toMatch(/class="wp-block-tabs np-tabs--pills[ "]/);
    expect(out).toContain('data-np-tabs');
    expect(out).toContain('role="tablist"');
    expect(out).toMatch(new RegExp(`<button[^>]*id="${first.tab}"[^>]*aria-controls="${first.panel}"[^>]*aria-selected="true"[^>]*tabindex="0"`));
    expect(out).toMatch(new RegExp(`<button[^>]*id="${second.tab}"[^>]*aria-selected="false"[^>]*tabindex="-1"`));
    expect(out).toMatch(new RegExp(`id="${second.panel}"[^>]*aria-labelledby="${second.tab}"[^>]*hidden`));
    expect(out).not.toMatch(new RegExp(`id="${first.panel}"[^>]*hidden`));
    expect(out).toContain('pnpm add');
  });

  it('falls back to the underline look for an unknown look', () => {
    expect(html(tabs({ look: 'neon' }))).toContain('np-tabs--underline');
  });

  it('shows a Tab outside Tabs as a plain section', () => {
    const out = html(tab('lone', 'Solo', 'Alone'));
    expect(out).toContain('wp-block-tab');
    expect(out).toContain('Alone');
    expect(out).not.toContain('role="tab"');
  });

  it('writes the responsive rules twice (page and editor preview)', () => {
    expect(TABS_CSS).toContain('@media (max-width: 767px)');
    expect(TABS_CSS).toContain('@container npb-canvas (max-width: 767px)');
  });
});

describe('tabs on the canvas', () => {
  it('shows only the first tab at the start and switches on click', () => {
    renderCanvas(null);
    expect(screen.getByText('npm install')).toBeVisible();
    expect(screen.getByText('pnpm add')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'pnpm' }));
    expect(screen.getByText('pnpm add')).toBeVisible();
    expect(screen.getByText('npm install')).not.toBeVisible();
    expect(screen.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a hidden tab when a block inside it gets selected', () => {
    const { select } = renderCanvas(null);
    expect(screen.getByText('pnpm add')).not.toBeVisible();
    select('t2-p');
    expect(screen.getByText('pnpm add')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with the arrow keys', () => {
    renderCanvas(null);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'npm' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'pnpm' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('tabs settings', () => {
  it('adds a tab that sits inside the tabs with a paragraph', () => {
    const onUpdate = vi.fn();
    render(<TabsSettings block={tabs()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Add tab/ }));
    const children = onUpdate.mock.calls[0][0].children as BlockConfig[];
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ name: 'core/tab', parentId: 'tabs1' });
    expect(children[2].children?.[0]).toMatchObject({ name: 'core/paragraph' });
  });

  it('renames a tab', () => {
    const onUpdate = vi.fn();
    render(<TabSettings block={tab('t1', 'npm', 'x')} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'yarn' } });
    expect(JSON.stringify(onUpdate.mock.calls)).toContain('yarn');
  });
});
