import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { DEFAULT_GRID_CONTENT, gridStyleVars, readGridContent } from '@shared/blocks/grid-model';
import { GRID_CSS } from '@shared/blocks/grid-css';
import { buildLayoutSpans, matchLayout, withSpanAt } from '@shared/blocks/grid-layouts';
import { applyRatio, matchRatio, ratiosFor } from '@shared/columns-ratios';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { GridSettings } from '@/components/PageBuilder/blocks/grid/grid-settings';
import { ColumnsSettings } from '@/components/PageBuilder/blocks/columns/columns-settings';

const stubActions: BlockActionsContextValue = {
  selectedBlockId: null, editingBlockId: null, hoveredBlockId: null,
  onSelect: () => {}, onStartEditing: () => {}, onStopEditing: () => {}, onHoverBlock: () => {},
  onDuplicate: () => {}, onDelete: () => {}, hoverHighlight: null,
};

type Data = Record<string, unknown>;

const paragraph = (id: string, parentId: string): BlockConfig => ({
  id, name: 'core/paragraph', type: 'block', parentId, label: 'Paragraph', category: 'basic',
  content: { kind: 'text', value: `Item ${id}` }, styles: {}, settings: {},
});

const gridOf = (data: Data, count = 5): BlockConfig => ({
  id: 'g', name: 'core/grid', type: 'container', parentId: null, label: 'Grid', category: 'layout',
  content: { kind: 'structured', data }, styles: {}, settings: {},
  children: Array.from({ length: count }, (_, index) => paragraph(`p${index + 1}`, 'g')),
});

const published = (block: BlockConfig): string => {
  const Component = getBlockComponent(block.name);
  if (!Component) throw new Error(`No published renderer for ${block.name}`);
  return renderToStaticMarkup(<Component {...block} />);
};

type CanvasProps = { value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean };
const renderCanvas = (block: BlockConfig) => {
  const Component = blockRegistry[block.name].component as React.ComponentType<CanvasProps>;
  return render(
    <BlockActionsProvider value={stubActions}>
      <Component value={block} onChange={() => {}} isPreview />
    </BlockActionsProvider>,
  );
};

const FEATURED = { columns: 3, tabletColumns: 2, phoneColumns: 1, spans: [{ columns: 2, rows: 2 }] };

/** The `--np-span-*` variables written on the first element that has any. */
const spanVarsIn = (html: string): string[] => (html.match(/--np-span-[crt]-\d+:\d+/g) ?? []).sort();

describe('grid item sizes: reading', () => {
  it('defaults to no sizes', () => {
    expect(DEFAULT_GRID_CONTENT.spans).toEqual([]);
    expect(readGridContent(undefined).spans).toEqual([]);
  });

  it('keeps columns 1-4 and rows 1-3, at most 24 entries, and never throws', () => {
    const spans = readGridContent({ kind: 'structured', data: { spans: [{ columns: 9, rows: 9 }, { columns: 0, rows: -2 }, { columns: '2', rows: 'x' }, null, 'bad', {}] } }).spans;
    expect(spans).toEqual([{ columns: 4, rows: 3 }, { columns: 1, rows: 1 }, { columns: 2, rows: 1 }, { columns: 1, rows: 1 }, { columns: 1, rows: 1 }, { columns: 1, rows: 1 }]);
    const many = Array.from({ length: 40 }, () => ({ columns: 2, rows: 1 }));
    expect(readGridContent({ kind: 'structured', data: { spans: many } }).spans).toHaveLength(24);
    for (const bad of ['text', 5, {}, true, null]) {
      expect(readGridContent({ kind: 'structured', data: { spans: bad } }).spans).toEqual([]);
    }
  });

  it('cuts column spans to the desktop and tablet column counts in the model', () => {
    const vars = gridStyleVars(readGridContent({ kind: 'structured', data: { columns: 2, tabletColumns: 2, spans: [{ columns: 3, rows: 2 }] } }));
    expect(vars['--np-span-c-1']).toBe('2');
    expect(vars['--np-span-r-1']).toBe('2');
    expect(vars['--np-span-t-1']).toBe('2');
    const oneTablet = gridStyleVars(readGridContent({ kind: 'structured', data: { columns: 4, tabletColumns: 1, spans: [{ columns: 3, rows: 1 }] } }));
    expect(oneTablet['--np-span-c-1']).toBe('3');
    expect(oneTablet['--np-span-t-1']).toBe('1');
  });

  it('writes no size variables for 1x1 items or while fitting by width', () => {
    expect(spanVarsIn(JSON.stringify(gridStyleVars(readGridContent({ kind: 'structured', data: { spans: [{ columns: 1, rows: 1 }] } }))))).toEqual([]);
    expect(Object.keys(gridStyleVars(readGridContent({ kind: 'structured', data: { minItemWidth: '200px', spans: [{ columns: 2, rows: 2 }] } }))).some((key) => key.startsWith('--np-span'))).toBe(false);
  });
});

describe('criterion 1: Featured on a published 3-column grid', () => {
  it('item 1 spans 2 columns and 2 rows; the grid fills holes', () => {
    const html = published(gridOf(FEATURED));
    expect(html).toContain('class="wp-block-grid has-spans block-g"');
    expect(spanVarsIn(html)).toEqual(['--np-span-c-1:2', '--np-span-r-1:2', '--np-span-t-1:2']);
    expect(html).toMatch(/<div class="np-grid__items"><p [^>]*>Item p1<\/p><p [^>]*>Item p2<\/p>/);
    expect(GRID_CSS).toContain('.wp-block-grid.has-spans > .np-grid__items > :nth-child(1) { grid-column: span var(--np-span-c-1); grid-row: span var(--np-span-r-1); }');
    expect(GRID_CSS).toContain('.wp-block-grid.has-spans > .np-grid__items { grid-auto-flow: row dense; }');
    expect(GRID_CSS).toContain(':nth-child(24)');
    expect(GRID_CSS).not.toContain(':nth-child(25)');
  });

  it('puts the variables on the grid element, where the items element inherits them', () => {
    const html = published(gridOf(FEATURED));
    const opening = html.slice(0, html.indexOf('<div class="np-grid__items"'));
    expect(opening).toContain('--np-span-c-1:2');
  });
});

describe('criterion 2: the canvas lays out like the page', () => {
  it('carries the same variables and class on the same element', () => {
    const { container } = renderCanvas(gridOf(FEATURED));
    const grid = container.querySelector('.wp-block-grid') as HTMLElement;
    expect(grid).toHaveClass('has-spans');
    expect(grid.style.getPropertyValue('--np-span-c-1')).toBe('2');
    expect(grid.style.getPropertyValue('--np-span-r-1')).toBe('2');
    expect(grid.style.getPropertyValue('--np-span-t-1')).toBe('2');
    expect(spanVarsIn(published(gridOf(FEATURED)))).toEqual(spanVarsIn(grid.getAttribute('style')?.replace(/--np-span-([crt])-(\d+): (\d+);?/g, '--np-span-$1-$2:$3 ') ?? ''));
  });

  it('has exactly one child per item, in order, directly inside the items element', () => {
    const block = gridOf(FEATURED, 4);
    const { container } = renderCanvas(block);
    const items = container.querySelector('.wp-block-grid > .np-grid__items') as HTMLElement;
    expect(items.children).toHaveLength(4);
    block.children?.forEach((child, index) => {
      expect(within(items.children[index] as HTMLElement).getByText(`Item ${child.id}`)).toBeInTheDocument();
    });
  });

  it('counts around the drop bar the editor shows while dragging', () => {
    expect(GRID_CSS).toContain('.npb-canvas-page .wp-block-grid.has-spans > .np-grid__items > :nth-child(1 of :not([aria-hidden="true"])) { grid-column: span var(--np-span-c-1)');
    expect(GRID_CSS).toContain('.npb-canvas-page .wp-block-grid.has-spans > .np-grid__items > [aria-hidden="true"] { grid-column: auto; grid-row: auto; }');
  });
});

describe('criterion 3: tablet and phone', () => {
  const section = (start: string): string => {
    const from = GRID_CSS.indexOf(start);
    return GRID_CSS.slice(from, GRID_CSS.indexOf('\n}', from));
  };

  it('tablet uses the already-clamped tablet span, in the page and the canvas', () => {
    const vars = gridStyleVars(readGridContent({ kind: 'structured', data: { columns: 3, tabletColumns: 2, spans: [{ columns: 3, rows: 1 }] } }));
    expect(vars['--np-span-c-1']).toBe('3');
    expect(vars['--np-span-t-1']).toBe('2');
    expect(section('@media (min-width: 768px) and (max-width: 1023px)')).toContain(':nth-child(1) { grid-column: span var(--np-span-t-1); }');
    expect(section('@container npb-canvas (min-width: 768px) and (max-width: 1023px)')).toContain('.npb-canvas-page .wp-block-grid.has-spans > .np-grid__items > :nth-child(1 of :not([aria-hidden="true"])) { grid-column: span var(--np-span-t-1); }');
  });

  it('phone shows every item as one cell, in the page and the canvas', () => {
    const page = section('@media (max-width: 767px)');
    expect(page).toContain('.wp-block-grid.has-spans > .np-grid__items > * { grid-column: auto !important; grid-row: auto !important; }');
    expect(page).toContain('grid-auto-flow: row;');
    const canvas = section('@container npb-canvas (max-width: 767px)');
    expect(canvas).toContain('.npb-canvas-page .wp-block-grid.has-spans > .np-grid__items > * { grid-column: auto !important; grid-row: auto !important; }');
    expect(canvas).toContain('grid-auto-flow: row;');
  });

  it('fit by width keeps working with sizes saved: no size classes or variables', () => {
    const html = published(gridOf({ minItemWidth: '200px', columns: 3, spans: [{ columns: 2, rows: 2 }] }));
    expect(html).toContain('wp-block-grid has-min-width block-g');
    expect(html).not.toContain('has-spans');
    expect(html).not.toContain('--np-span');
    expect(GRID_CSS).toContain('auto-fit');
  });
});

describe('criterion 4: grids without sizes are unchanged', () => {
  it('writes no size class or variable', () => {
    for (const data of [{}, { columns: 4, tabletColumns: 3, phoneColumns: 2, align: 'center' }, { spans: [] }, { spans: [{ columns: 1, rows: 1 }] }]) {
      const html = published(gridOf(data));
      expect(html).not.toContain('has-spans');
      expect(html).not.toContain('--np-span');
      expect(html).toMatch(/^<div class="wp-block-grid block-g" style="--np-grid-cols:\d;--np-grid-cols-tablet:\d;--np-grid-cols-phone:\d;--np-grid-align:\w+">/);
    }
    const { container } = renderCanvas(gridOf({ columns: 3 }));
    expect((container.querySelector('.wp-block-grid') as HTMLElement).className).toBe('wp-block-grid');
  });
});

describe('criterion 5: layout presets and item sizes', () => {
  const lastUpdate = (onUpdate: ReturnType<typeof vi.fn>) => JSON.parse(JSON.stringify(onUpdate.mock.calls.at(-1)?.[0]));
  const openLayout = () => fireEvent.click(screen.getByRole('button', { name: /^Layout/ }));

  it('builds each preset', () => {
    expect(buildLayoutSpans({ layout: 'equal', itemCount: 6 })).toEqual([]);
    expect(buildLayoutSpans({ layout: 'featured', itemCount: 6 })).toEqual([{ columns: 2, rows: 2 }]);
    expect(buildLayoutSpans({ layout: 'wide-first', itemCount: 6 })).toEqual([{ columns: 2, rows: 1 }]);
    expect(buildLayoutSpans({ layout: 'alternating', itemCount: 6 }).map((span) => span.columns)).toEqual([2, 1, 1, 2, 2]); // a trailing 1x1 is the same as no entry
    expect(matchLayout({ spans: [{ columns: 2, rows: 2 }], itemCount: 5 })).toBe('featured');
    expect(matchLayout({ spans: [{ columns: 1, rows: 2 }], itemCount: 5 })).toBeNull();
    expect(withSpanAt({ spans: [], index: 2, span: { columns: 2, rows: 1 } })).toEqual([{ columns: 1, rows: 1 }, { columns: 1, rows: 1 }, { columns: 2, rows: 1 }]);
  });

  it('writes the layout chosen', () => {
    const onUpdate = vi.fn();
    render(<GridSettings block={gridOf({ columns: 3 })} onUpdate={onUpdate} />);
    openLayout();
    fireEvent.click(screen.getByRole('radio', { name: 'Featured' }));
    expect(lastUpdate(onUpdate).content.data.spans).toEqual([{ columns: 2, rows: 2 }]);
    fireEvent.click(screen.getByRole('radio', { name: 'Alternating' }));
    expect(lastUpdate(onUpdate).content.data.spans.map((span: { columns: number }) => span.columns)).toEqual([2, 1, 1, 2, 2]);
    fireEvent.click(screen.getByRole('radio', { name: 'Equal' }));
    expect(lastUpdate(onUpdate).content.data.spans).toEqual([]);
  });

  it('shows the layout that matches the saved sizes, and none for a custom mix', () => {
    const { unmount } = render(<GridSettings block={gridOf({ columns: 3, spans: [{ columns: 2, rows: 2 }] })} onUpdate={() => {}} />);
    openLayout();
    expect(screen.getByRole('radio', { name: 'Featured' })).toHaveAttribute('aria-checked', 'true');
    unmount();
    render(<GridSettings block={gridOf({ columns: 3, spans: [{ columns: 1, rows: 2 }] })} onUpdate={() => {}} />);
    openLayout();
    for (const name of ['Equal', 'Featured', 'Wide first', 'Alternating']) {
      expect(screen.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('lists one row of size chips per item, showing current sizes, and writes a change', () => {
    const onUpdate = vi.fn();
    render(<GridSettings block={gridOf({ columns: 3, spans: [{ columns: 2, rows: 2 }] }, 4)} onUpdate={onUpdate} />);
    openLayout();
    for (const index of [1, 2, 3, 4]) expect(screen.getByRole('radiogroup', { name: `Item ${index} size` })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Item 5 size' })).toBeNull();
    const first = within(screen.getByRole('radiogroup', { name: 'Item 1 size' }));
    expect(first.getByRole('radio', { name: '2×2' })).toHaveAttribute('aria-checked', 'true');
    const third = within(screen.getByRole('radiogroup', { name: 'Item 3 size' }));
    expect(third.getByRole('radio', { name: '1×1' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(third.getByRole('radio', { name: 'Full row' }));
    expect(lastUpdate(onUpdate).content.data.spans).toEqual([{ columns: 2, rows: 2 }, { columns: 1, rows: 1 }, { columns: 3, rows: 1 }]);
  });

  it('turns chips off with an inline reason', () => {
    const { unmount } = render(<GridSettings block={gridOf({ columns: 1 })} onUpdate={() => {}} />);
    openLayout();
    expect(screen.getByRole('radio', { name: 'Featured' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Alternating' })).toBeDisabled();
    expect(within(screen.getByRole('radiogroup', { name: 'Item 1 size' })).getByRole('radio', { name: '2×1' })).toBeDisabled();
    expect(screen.getAllByText(/Needs 2 or more columns\./).length).toBeGreaterThan(0);
    expect(screen.getByText(/Needs 3 columns\./)).toBeInTheDocument();
    unmount();

    render(<GridSettings block={gridOf({ columns: 4 })} onUpdate={() => {}} />);
    openLayout();
    expect(screen.getByRole('radio', { name: 'Featured' })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Alternating' })).toBeDisabled();
    expect(screen.getByText(/Needs 3 columns\./)).toBeInTheDocument();
  });

  it('turns every size off while fitting by width, with the reason', () => {
    render(<GridSettings block={gridOf({ minItemWidth: '240px' })} onUpdate={() => {}} />);
    openLayout();
    expect(screen.getByRole('radio', { name: 'Featured' })).toBeDisabled();
    expect(within(screen.getByRole('radiogroup', { name: 'Item 1 size' })).getByRole('radio', { name: '1×2' })).toBeDisabled();
    expect(screen.getAllByText(/fitting by width/).length).toBeGreaterThan(0);
  });
});

describe('criterion 6: Columns ratio presets', () => {
  const columnsBlock = (widths: string[]): BlockConfig => ({
    id: 'cols', name: 'core/columns', type: 'container', parentId: null, label: 'Columns', category: 'layout',
    content: { kind: 'structured', data: { layoutMode: 'flex', gap: '20px', minColumnWidth: '0px' } },
    styles: {}, settings: { columnLayout: widths.map((width, index) => ({ columnId: `c${index + 1}`, width, blockIds: [] })) },
    children: [],
  });
  const layoutOf = (block: BlockConfig) => (block.settings?.columnLayout ?? []) as { columnId: string; width?: string; blockIds: string[] }[];

  it('offers the listed ratios for 2 and 3 columns and none for 4', () => {
    expect(ratiosFor(2).map((ratio) => ratio.label)).toEqual(['50/50', '60/40', '40/60', '67/33', '33/67', '75/25', '25/75']);
    expect(ratiosFor(3).map((ratio) => ratio.label)).toEqual(['33/33/33', '50/25/25', '25/50/25', '25/25/50']);
    expect(ratiosFor(4)).toEqual([]);
  });

  it('writes the existing column widths', () => {
    const onUpdate = vi.fn();
    render(<ColumnsSettings block={columnsBlock(['50%', '50%'])} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: '60/40' }));
    const written = onUpdate.mock.calls.at(-1)?.[0].settings.columnLayout as { width: string }[];
    expect(written.map((column) => column.width)).toEqual(['60%', '40%']);
    expect(onUpdate.mock.calls.at(-1)?.[0].content).toBeUndefined();
  });

  it('written widths render as those percentages on the published page, and re-opening picks the chip', () => {
    const base = columnsBlock(['50%', '50%']);
    const ratio = ratiosFor(2).find((item) => item.label === '67/33');
    if (!ratio) throw new Error('missing ratio');
    const next = { ...base, settings: { columnLayout: applyRatio({ layout: layoutOf(base), ratio }) } };
    const Columns = getBlockComponent('core/columns');
    if (!Columns) throw new Error('no columns renderer');
    const html = renderToStaticMarkup(<Columns {...next} />);
    expect(html).toMatch(/width:calc\(\(100% - 1 \* \(20px\)\) \* 0\.6667/);
    expect(html).toMatch(/width:calc\(\(100% - 1 \* \(20px\)\) \* 0\.3333\)/);

    render(<ColumnsSettings block={next} onUpdate={() => {}} />);
    expect(screen.getByRole('radio', { name: '67/33' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '50/50' })).toHaveAttribute('aria-checked', 'false');
  });

  it('selects the three-column split the "3 columns" button writes, and nothing for custom widths', () => {
    expect(matchRatio(layoutOf(columnsBlock(['33.33%', '33.33%', '33.33%'])))?.label).toBe('33/33/33');
    expect(matchRatio(layoutOf(columnsBlock(['50%', '25%', '25%'])))?.label).toBe('50/25/25');
    for (const custom of [['55%', '45%'], ['240px', '1fr'], ['auto', 'auto'], ['calc(50% - 10px)', '50%']]) {
      expect(matchRatio(layoutOf(columnsBlock(custom)))).toBeNull();
    }
    render(<ColumnsSettings block={columnsBlock(['55%', '45%'])} onUpdate={() => {}} />);
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toHaveAttribute('aria-checked', 'false'));
  });

  it('says presets are for 2 or 3 columns when there are other counts', () => {
    render(<ColumnsSettings block={columnsBlock(['25%', '25%', '25%', '25%'])} onUpdate={() => {}} />);
    expect(screen.getByText('Ratio presets are for 2 or 3 columns.')).toBeInTheDocument();
  });

  it('phones still stack and reverse: the stacking and reverse rules are untouched', async () => {
    const { PUBLISH_BLOCK_CSS } = await import('@shared/publish-block-css');
    expect(PUBLISH_BLOCK_CSS).toContain('.wp-block-columns {\n    flex-direction: column !important;');
    expect(PUBLISH_BLOCK_CSS).toContain('flex-direction: column-reverse !important;');
  });
});
