import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { readGridContent, gridStyleVars } from '@shared/blocks/grid-model';
import { GRID_CSS } from '@shared/blocks/grid-css';
import { CARD_CSS } from '@shared/blocks/card-css';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { GridSettings } from '@/components/PageBuilder/blocks/grid/grid-settings';
import { CardSettings } from '@/components/PageBuilder/blocks/card/card-settings';

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
  id, name: 'core/paragraph', type: 'block', parentId, label: 'Paragraph', category: 'basic',
  content: { kind: 'text', value: text }, styles: {}, settings: {},
});

const container = (name: string, data: Record<string, string | number>, children: BlockConfig[]): BlockConfig => ({
  id: 'b1', name, type: 'container', parentId: null, label: name, category: 'layout',
  content: { kind: 'structured', data }, styles: {}, settings: {}, children,
});
const grid = (data: Record<string, string | number> = {}) =>
  container('core/grid', data, [paragraph('p1', 'First item', 'b1'), paragraph('p2', 'Second item', 'b1')]);
const card = (data: Record<string, string> = {}) => container('core/card', data, [paragraph('c1', 'Inside the card', 'b1')]);

const renderPublished = (block: BlockConfig): string => {
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

describe('grid', () => {
  it('reads forgiving counts and writes CSS variables', () => {
    const content = readGridContent({ kind: 'structured', data: { columns: 9, phoneColumns: 7, align: 'bottom', minItemWidth: ' 240px ' } });
    expect(content).toMatchObject({ columns: 6, phoneColumns: 3, align: 'stretch', minItemWidth: '240px' });
    expect(gridStyleVars(content)['--np-grid-min']).toBe('240px');
  });

  it('publishes the wrapper, variables and items', () => {
    const html = renderPublished(grid({ columns: 4, tabletColumns: 3, phoneColumns: 2, align: 'center' }));
    expect(html).toContain('class="wp-block-grid block-b1"');
    expect(html).toContain('--np-grid-cols:4');
    expect(html).toContain('--np-grid-cols-tablet:3');
    expect(html).toContain('--np-grid-cols-phone:2');
    expect(html).toContain('--np-grid-align:center');
    expect(html).toMatch(/<div class="np-grid__items">.*First item.*Second item/);
    expect(html).not.toContain('--np-grid-min');
  });

  it('switches to fit by width', () => {
    const html = renderPublished(grid({ minItemWidth: '240px' }));
    expect(html).toContain('wp-block-grid has-min-width block-b1');
    expect(html).toContain('--np-grid-min:240px');
  });

  it('has phone and tablet rules for both published pages and the editor preview', () => {
    expect(GRID_CSS).toContain('@media (max-width: 767px)');
    expect(GRID_CSS).toContain('@container npb-canvas (max-width: 767px)');
    expect(GRID_CSS).toContain('.npb-canvas-page .wp-block-grid');
    expect(GRID_CSS).toContain('--np-grid-cols-tablet');
    expect(GRID_CSS).toContain('auto-fit');
  });

  it('shows its items on the canvas inside the items element', () => {
    const { container: dom } = renderCanvas(grid());
    expect(dom.querySelector('.wp-block-grid .np-grid__items')).not.toBeNull();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
  });

  it('leaves the items list to the grid CSS on the canvas, so "stretch" works there as on the page', () => {
    const { container: dom } = renderCanvas(grid());
    const items = dom.querySelector<HTMLElement>('.np-grid__items');
    expect(items?.style.display).toBe('');
    expect(items?.style.alignItems).toBe('');
    expect(items?.style.flexDirection).toBe('');
  });

  it('passes a stretched cell\'s height through the editor\'s boxes to the item, on the canvas only', () => {
    expect(GRID_CSS).toContain('.npb-canvas-page .wp-block-grid .np-grid__items > [data-rfd-draggable-id] div:has([data-block-id])');
    expect(GRID_CSS).toMatch(/\[data-block-id\]:not\([^)]*\[data-block-id\] \[data-block-id\]\) > div > \* \{ height: 100%; \}/);
  });

  it('sets the column count from the settings chips', () => {
    const onUpdate = vi.fn();
    render(<GridSettings block={grid()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getAllByRole('radio', { name: '4' })[0]);
    expect(onUpdate).toHaveBeenCalled();
    expect(JSON.stringify(onUpdate.mock.calls[0][0])).toContain('"columns":4');
  });

  it('turns the counts off, with a reason, when fitting by width', () => {
    render(<GridSettings block={grid({ minItemWidth: '240px' })} onUpdate={() => {}} />);
    expect(screen.getAllByRole('radio', { name: '3' })[0]).toBeDisabled();
    expect(screen.getByText(/counts are off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear/ })).toBeInTheDocument();
  });
});

describe('card', () => {
  it('publishes a plain card without a link', () => {
    const html = renderPublished(card());
    expect(html).toContain('class="wp-block-card np-card--bordered block-b1"');
    expect(html).toContain('<div class="np-card__body">');
    expect(html).toContain('Inside the card');
    expect(html).not.toContain('np-card__link');
  });

  it('publishes an overlay link beside the body, not around it', () => {
    const html = renderPublished(card({ look: 'raised', link: '/pricing', linkLabel: 'Read the pricing guide', linkTarget: '_blank' }));
    expect(html).toContain('wp-block-card np-card--raised is-linked');
    expect(html).toMatch(/<a class="np-card__link" href="\/pricing" aria-label="Read the pricing guide" target="_blank" rel="noopener noreferrer"><\/a><div class="np-card__body">/);
  });

  it('names the link "Open" when there is no label', () => {
    expect(renderPublished(card({ link: '/x' }))).toContain('aria-label="Open"');
  });

  it('styles each look and respects reduced motion', () => {
    ['bordered', 'raised', 'subtle', 'plain'].forEach((look) => expect(CARD_CSS).toContain(`.np-card--${look}`));
    expect(CARD_CSS).toContain('prefers-reduced-motion');
  });

  it('shows children and a link note, but no overlay link, on the canvas', () => {
    const { container: dom } = renderCanvas(card({ link: 'https://example.com' }));
    expect(screen.getByText('Inside the card')).toBeInTheDocument();
    expect(screen.getByText('Links to https://example.com')).toBeInTheDocument();
    expect(dom.querySelector('.np-card__link')).toBeNull();
    expect(dom.querySelector('.wp-block-card.is-linked .np-card__body')).not.toBeNull();
  });

  it('hides the link label until there is a link, and explains the new-tab switch', () => {
    const { rerender } = render(<CardSettings block={card()} onUpdate={() => {}} />);
    expect(screen.queryByLabelText('Link label')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Open in new tab' })).toBeDisabled();
    expect(screen.getByText(/Add a link first/)).toBeInTheDocument();
    rerender(<CardSettings block={card({ link: '/x' })} onUpdate={() => {}} />);
    expect(screen.getByLabelText('Link label')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Open in new tab' })).not.toBeDisabled();
  });

  it('writes the look from the chips', () => {
    const onUpdate = vi.fn();
    render(<CardSettings block={card()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Raised' }));
    expect(JSON.stringify(onUpdate.mock.calls[0][0])).toContain('"look":"raised"');
  });
});
