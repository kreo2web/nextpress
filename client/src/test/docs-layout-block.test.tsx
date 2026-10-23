import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { bindDocsLayoutBlocks } from '@shared/blocks/bind-docs-layout';
import type { DocsPage } from '@shared/blocks/docs-layout-tree';
import { DOCS_LAYOUT_CSS } from '@shared/blocks/docs-layout-css';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { PageProvider } from '@/components/PageBuilder/PageContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { DocsLayoutSettings } from '@/components/PageBuilder/blocks/docs-layout/docs-layout-settings';

const mockPages = vi.hoisted(() => ({
  list: [
    { id: 'docs', title: 'Docs', slug: 'docs', parentId: null, menuOrder: 0, status: 'publish', password: null },
    { id: 'start', title: 'Getting started', slug: 'start', parentId: 'docs', menuOrder: 1, status: 'publish', password: null },
    { id: 'guides', title: 'Guides', slug: 'guides', parentId: 'docs', menuOrder: 2, status: 'publish', password: null },
  ],
}));

vi.mock('@/components/PageBuilder/blocks/docs-layout/use-site-docs-pages', () => ({
  useSiteDocsPages: () => ({ pages: mockPages.list, isLoading: false }),
}));

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

const heading = (id: string, value: string, level: number): BlockConfig => ({
  id,
  name: 'core/heading',
  type: 'block',
  parentId: 'docs1',
  label: 'Heading',
  category: 'basic',
  content: { kind: 'text', value, level },
  styles: {},
  settings: {},
});

const markdown = (id: string, content: string): BlockConfig => ({
  id,
  name: 'core/markdown',
  type: 'block',
  parentId: 'docs1',
  label: 'Markdown',
  category: 'advanced',
  content: { kind: 'structured', data: { content, mdx: true } },
  styles: {},
  settings: {},
});

const docsBlock = (data: Record<string, unknown> = {}, children: BlockConfig[] = [heading('h1', 'Why it works', 2), markdown('m1', 'Intro.\n\n## Setup\n\n### Details here\n\n## Setup\n')]): BlockConfig => ({
  id: 'docs1',
  name: 'core/docs-layout',
  type: 'container',
  parentId: null,
  label: 'Docs layout',
  category: 'layout',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
  children,
});

const SITE_PAGES: DocsPage[] = mockPages.list;

const publishedHtml = (block: BlockConfig): string => {
  const Component = getBlockComponent(block.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...block} />);
};

const bound = (block = docsBlock()): BlockConfig =>
  bindDocsLayoutBlocks({ blocks: [block], pages: SITE_PAGES, currentPageId: 'start' })[0];

describe('published docs layout', () => {
  it('draws the sidebar, breadcrumbs, toolbar, content, pager and contents with the right aria', () => {
    document.body.innerHTML = publishedHtml(bound());
    const root = document.querySelector('[data-np-docs]');
    expect(root).toHaveClass('wp-block-docs-layout', 'np-docs');
    expect(document.querySelector('nav[aria-label="Docs"]')).not.toBeNull();
    const current = document.querySelectorAll('nav[aria-label="Docs"] [aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Getting started');
    expect(current[0].getAttribute('href')).toBe('/docs/start');
    expect(document.querySelector('nav[aria-label="Breadcrumb"] [aria-current="page"]')?.textContent).toBe('Getting started');
    expect(document.querySelector('nav[aria-label="Previous and next pages"] a[rel="prev"]')?.getAttribute('href')).toBe('/docs');
    expect(document.querySelector('nav[aria-label="Previous and next pages"] a[rel="next"]')?.getAttribute('href')).toBe('/docs/guides');
    expect(document.querySelector('nav[aria-label="On this page"]')).not.toBeNull();
    expect(document.querySelector('.np-docs__content')?.textContent).toContain('Why it works');
  });

  it('links Copy page and Open as markdown to the page copy', () => {
    document.body.innerHTML = publishedHtml(bound());
    expect(document.querySelector('[data-np-docs-copy]')?.getAttribute('data-markdown')).toBe('/docs/start.md');
    expect(document.querySelector('a[href="/docs/start.md"]')?.textContent).toBe('Open as markdown');
  });

  it('wires the Menu button to the drawer', () => {
    document.body.innerHTML = publishedHtml(bound());
    const menu = document.querySelector('button[data-np-docs-menu]');
    expect(menu?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.getAttribute('aria-controls')).toBe(document.querySelector('[data-np-docs-drawer]')?.id);
    expect(menu?.textContent).toBe('Menu');
  });

  it('gives On this page links ids that exist on the rendered headings (heading block and markdown)', () => {
    document.body.innerHTML = publishedHtml(bound());
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.np-docs__toc a'));
    expect(links.map((link) => link.textContent)).toEqual(['Why it works', 'Setup', 'Details here', 'Setup']);
    links.forEach((link) => {
      const target = document.getElementById(decodeURIComponent(link.getAttribute('href')!.slice(1)));
      expect(target, link.getAttribute('href') ?? '').not.toBeNull();
      expect(target?.tagName).toMatch(/^H[23]$/);
      expect(target?.textContent).toBe(link.textContent);
    });
    // h3 is indented and the second "Setup" got its own number, so no two links land in one place.
    expect(document.querySelector('.np-docs__toc-item--h3')?.textContent).toBe('Details here');
    expect(new Set(links.map((link) => link.getAttribute('href'))).size).toBe(4);
  });

  it('honours the switches', () => {
    const off = bound(docsBlock({ showToc: false, showPrevNext: false, showBreadcrumbs: false, copyPage: false }));
    document.body.innerHTML = publishedHtml(off);
    expect(document.querySelector('nav[aria-label="On this page"]')).toBeNull();
    expect(document.querySelector('.np-docs__pager')).toBeNull();
    expect(document.querySelector('.np-docs__crumbs')).toBeNull();
    expect(document.querySelector('[data-np-docs-copy]')).toBeNull();
    expect(document.querySelector('nav[aria-label="Docs"]')).not.toBeNull();
  });

  it('renders the content alone, without a sidebar, when the page was not bound', () => {
    document.body.innerHTML = publishedHtml(docsBlock());
    expect(document.querySelector('.np-docs__content')?.textContent).toContain('Why it works');
    expect(document.querySelector('nav')).toBeNull();
    expect(document.querySelector('.np-docs')).toHaveClass('np-docs--no-nav', 'np-docs--no-toc');
  });

  it('writes every responsive rule for the page and for the editor preview', () => {
    for (const width of ['1023px', '767px']) {
      expect(DOCS_LAYOUT_CSS).toContain(`@media (max-width:${width})`);
      expect(DOCS_LAYOUT_CSS).toContain(`@container npb-canvas (max-width:${width})`);
    }
    expect(DOCS_LAYOUT_CSS).toContain('prefers-reduced-motion');
    expect(DOCS_LAYOUT_CSS).toContain('position: sticky');
  });
});

type CanvasProps = { value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean };

const canvasChildren = [heading('h1', 'Why it works', 2), heading('h2', 'Sub point', 3)];

const renderCanvas = ({ block = docsBlock({}, canvasChildren), pageId = 'start' as string | undefined } = {}) => {
  const Component = blockRegistry['core/docs-layout'].component as React.ComponentType<CanvasProps>;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PageProvider pageId={pageId}>
        <BlockActionsProvider value={stubActions}>
          <Component value={block} onChange={() => {}} isPreview />
        </BlockActionsProvider>
      </PageProvider>
    </QueryClientProvider>,
  );
};

describe('docs layout on the canvas', () => {
  it('shows the sidebar from the site pages with the open page marked, and Menu toggles the drawer', () => {
    const { container } = renderCanvas();
    const current = container.querySelector('nav[aria-label="Docs"] [aria-current="page"]');
    expect(current?.textContent).toBe('Getting started');
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')).not.toBeNull();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('[data-np-docs]')).toHaveAttribute('data-menu-open', 'true');
  });

  it('follows the blocks inside for On this page, and still works on a page that is not saved yet', () => {
    const { container } = renderCanvas({ pageId: undefined });
    expect(screen.getAllByRole('link', { name: 'Why it works' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Sub point' }).length).toBeGreaterThan(0);
    expect(container.querySelector('.np-docs__content')).not.toBeNull();
  });

  it('uses the same classes as the published page', () => {
    const { container } = renderCanvas({ pageId: undefined });
    const root = container.querySelector('[data-np-docs]');
    expect(root).toHaveClass('wp-block-docs-layout', 'np-docs');
    expect(container.querySelector('.np-docs__main')).not.toBeNull();
    expect(container.querySelector('.np-docs__toc')).not.toBeNull();
  });

  it('does not follow links on the canvas', () => {
    const { container } = renderCanvas({ pageId: undefined });
    const link = container.querySelector<HTMLAnchorElement>('.np-docs__toc a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('is registered as a container that fills its slot', () => {
    expect(blockRegistry['core/docs-layout']).toMatchObject({ isContainer: true, handlesOwnChildren: true });
  });
});

describe('docs layout settings', () => {
  const renderSettings = (block = { ...docsBlock(), id: 'docs-settings' }, onUpdate = vi.fn()) => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DocsLayoutSettings block={block} onUpdate={onUpdate} />
      </QueryClientProvider>,
    );
    return onUpdate;
  };

  it('offers the four switches, all on by default', () => {
    renderSettings();
    for (const name of ['On this page', 'Previous and next', 'Breadcrumbs', 'Copy page buttons']) {
      expect(screen.getByRole('switch', { name })).toBeChecked();
    }
  });

  it('turns a switch off', async () => {
    const onUpdate = renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Breadcrumbs' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(JSON.stringify(onUpdate.mock.calls)).toContain('"showBreadcrumbs":false');
  });

  it('starts the root page on "Top of this section"', () => {
    renderSettings();
    expect(screen.getByRole('combobox', { name: 'Root page' })).toHaveTextContent('Top of this section');
  });
});
