import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { bindDocsShellBlocks } from '@shared/blocks/bind-docs-shell';
import type { DocsPage } from '@shared/blocks/docs-layout-tree';
import { readDocsShellContent, type DocsShellContent } from '@shared/blocks/docs-shell-model';
import { DOCS_SHELL_CSS } from '@shared/blocks/docs-shell-css';
import { getBlockEntry } from '@shared/block-catalog';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { PageProvider } from '@/components/PageBuilder/PageContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { buildBlockLibraryCategories } from '@/components/PageBuilder/BlockLibrary';
import { DocsShellSettings } from '@/components/PageBuilder/blocks/docs-shell/docs-shell-settings';

const mocks = vi.hoisted(() => ({
  pages: [
    { id: 'docs', title: 'Docs', slug: 'docs', parentId: null, menuOrder: 0, status: 'publish', password: null },
    { id: 'start', title: 'Getting started', slug: 'start', parentId: 'docs', menuOrder: 1, status: 'publish', password: null },
    { id: 'guides', title: 'Guides', slug: 'guides', parentId: 'docs', menuOrder: 2, status: 'publish', password: null },
  ],
  rootShell: { current: null as null | DocsShellContent },
}));

vi.mock('@/components/PageBuilder/blocks/docs-layout/use-site-docs-pages', () => ({
  useSiteDocsPages: () => ({ pages: mocks.pages, isLoading: false }),
}));
vi.mock('@/components/PageBuilder/blocks/docs-shell/use-root-shell', () => ({
  useRootShell: ({ pageId }: { pageId: string }) => ({
    rootShell: mocks.rootShell.current,
    root: pageId && pageId !== 'docs' ? { id: 'docs', title: 'Docs', path: '/docs' } : null,
  }),
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

const block = (b: Partial<BlockConfig> & { id: string; name: string }): BlockConfig => ({
  type: 'block',
  parentId: null,
  label: b.name,
  category: 'basic',
  content: { kind: 'structured', data: {} },
  styles: {},
  settings: {},
  ...b,
});

const heading = (id: string, value: string, level: number): BlockConfig =>
  block({ id, name: 'core/heading', parentId: 'page1', content: { kind: 'text', value, level } });

const tree = (shellData: Record<string, unknown> = {}): BlockConfig =>
  block({
    id: 'shell1',
    name: 'docs/shell',
    type: 'container',
    category: 'docs',
    content: { kind: 'structured', data: shellData },
    children: [
      block({
        id: 'page1',
        name: 'docs/page',
        type: 'container',
        category: 'docs',
        parentId: 'shell1',
        children: [heading('h1', 'Why it works', 2), heading('h2', 'Sub point', 3)],
      }),
    ],
  });

const ROOT_DATA = { inherit: false, rootPageId: '', title: 'Acme Docs', logoUrl: '', links: [{ label: 'GitHub', url: 'https://github.com/acme' }], search: { show: true, label: 'Find', placeholder: 'Search' } };
const ROOT = readDocsShellContent({ kind: 'structured', data: ROOT_DATA });

const publishedHtml = (blocks: BlockConfig[]): string => {
  const [shell] = blocks;
  const Component = getBlockComponent(shell.name);
  if (!Component) throw new Error('missing renderer');
  return renderToStaticMarkup(<Component {...shell} />);
};

const bind = (shell: BlockConfig, rootShell: ReturnType<typeof readDocsShellContent> | null = null) =>
  bindDocsShellBlocks({ blocks: [shell], pages: mocks.pages as DocsPage[], currentPageId: 'start', description: 'Short intro.', rootShell });

describe('published docs shell and docs page', () => {
  it('draws the top bar, sidebar, title, description and reading column', () => {
    document.body.innerHTML = publishedHtml(bind(tree({ inherit: false, title: 'Own' })));
    expect(document.querySelector('.np-dshell__bar')).not.toBeNull();
    expect(document.querySelector('nav[aria-label="Docs"] [aria-current="page"]')?.textContent).toBe('Getting started');
    expect(document.querySelector('h1.np-dpage__title')?.textContent).toBe('Getting started');
    expect(document.querySelector('.np-dpage__description')?.textContent).toBe('Short intro.');
    expect(document.querySelector('.np-docs__content')?.textContent).toContain('Why it works');
    expect(document.querySelector('button[data-np-docs-menu]')?.getAttribute('aria-controls')).toBe(document.querySelector('[data-np-docs-drawer]')?.id);
  });

  it('inherit on shows the root page settings; inherit off shows its own', () => {
    const inherited = publishedHtml(bind(tree({ inherit: true, title: 'Own' }), ROOT));
    expect(inherited).toContain('Acme Docs');
    expect(inherited).toContain('https://github.com/acme');
    expect(inherited).not.toContain('Own');
    const own = publishedHtml(bind(tree({ inherit: false, title: 'Own' }), ROOT));
    expect(own).toContain('Own');
    expect(own).not.toContain('Acme Docs');
    expect(own).not.toContain('https://github.com/acme');
  });

  it('puts data-np-search-open on the search button, and leaves it out when search is off', () => {
    expect(publishedHtml(bind(tree()))).toContain('data-np-search-open');
    expect(publishedHtml(bind(tree({ search: { show: false, label: 'x', placeholder: 'y' } })))).not.toContain('data-np-search-open');
  });

  it('lists the headings of the page blocks with ids that exist on the rendered headings', () => {
    document.body.innerHTML = publishedHtml(bind(tree()));
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.np-docs__toc a'));
    expect(links.map((link) => link.textContent)).toEqual(['Why it works', 'Sub point']);
    links.forEach((link) => {
      const target = document.getElementById(decodeURIComponent(link.getAttribute('href')!.slice(1)));
      expect(target?.textContent).toBe(link.textContent);
    });
  });

  it('links previous and next in the order of the page tree', () => {
    document.body.innerHTML = publishedHtml(bind(tree()));
    expect(document.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe('/docs');
    expect(document.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/docs/guides');
  });

  it('folds On this page into a disclosure and makes the phone drawer, for the page and the editor preview', () => {
    document.body.innerHTML = publishedHtml(bind(tree()));
    expect(document.querySelector('details.np-docs__toc-fold')).not.toBeNull();
    for (const width of ['1023px', '767px']) {
      expect(DOCS_SHELL_CSS).toContain(`@media (max-width:${width})`);
      expect(DOCS_SHELL_CSS).toContain(`@container npb-canvas (max-width:${width})`);
    }
    expect(DOCS_SHELL_CSS).toContain('prefers-reduced-motion');
  });

  it('drops a link whose address is a script', () => {
    const html = publishedHtml(bind(tree({ inherit: false, links: [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Ok', url: '/blog' }] })));
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="/blog"');
  });
});

describe('canvas and published page share one view', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  it('shell: canvas and renderer both import docs-shell-view', () => {
    expect(read('../components/PageBuilder/blocks/docs-shell/DocsShellBlock.tsx')).toContain('@shared/blocks/docs-shell-view');
    expect(read('../../../renderer/react/docs/docs-shell.tsx')).toContain('@shared/blocks/docs-shell-view');
  });
  it('page: canvas and renderer both import docs-page-view', () => {
    expect(read('../components/PageBuilder/blocks/docs-page/DocsPageBlock.tsx')).toContain('@shared/blocks/docs-page-view');
    expect(read('../../../renderer/react/docs/docs-page.tsx')).toContain('@shared/blocks/docs-page-view');
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

type CanvasProps = { value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean };

const renderCanvas = (shell: BlockConfig, pageId: string | undefined = 'start') => {
  const Component = blockRegistry['docs/shell'].component as React.ComponentType<CanvasProps>;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PageProvider pageId={pageId}>
        <BlockActionsProvider value={stubActions}>
          <Component value={shell} onChange={() => {}} isPreview />
        </BlockActionsProvider>
      </PageProvider>
    </QueryClientProvider>,
  );
};

describe('docs shell on the canvas', () => {
  it('draws the same markup as the page, with the root settings when inheriting', () => {
    mocks.rootShell.current = ROOT;
    const { container } = renderCanvas(tree());
    expect(container.querySelector('.np-dshell')).toHaveClass('wp-block-docs-shell');
    expect(container.querySelector('.np-dshell__brand')?.textContent).toBe('Acme Docs');
    expect(container.querySelector('[data-np-search-open]')).not.toBeNull();
    expect(container.querySelector('h1.np-dpage__title')?.textContent).toBe('Getting started');
    expect(container.querySelectorAll('.np-docs__toc a')).toHaveLength(2);
    expect(container.querySelector('nav[aria-label="Docs"] [aria-current="page"]')?.textContent).toBe('Getting started');
  });

  it('Menu toggles the drawer, and links and search do nothing', () => {
    mocks.rootShell.current = null;
    const { container } = renderCanvas(tree());
    fireEvent.click(container.querySelector('button[data-np-docs-menu]')!);
    expect(container.querySelector('[data-np-docs]')).toHaveAttribute('data-menu-open', 'true');
    const search = container.querySelector<HTMLElement>('[data-np-search-open]')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    search.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('is registered as containers that fill their slot', () => {
    expect(blockRegistry['docs/shell']).toMatchObject({ isContainer: true, handlesOwnChildren: true });
    expect(blockRegistry['docs/page']).toMatchObject({ isContainer: true, handlesOwnChildren: true });
  });
});

describe('docs shell settings', () => {
  const renderSettings = (b: BlockConfig, pageId: string) => {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <Router hook={memoryLocation({ path: '/' }).hook}>
          <PageProvider pageId={pageId}>
            <DocsShellSettings block={b} onUpdate={vi.fn()} />
          </PageProvider>
        </Router>
      </QueryClientProvider>,
    );
  };

  it('on a child page says where the settings come from and links there', () => {
    renderSettings(tree({ inherit: true }), 'start');
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('href')).toBe('/admin/page-builder/page/docs');
    expect(screen.getByRole('switch', { name: "Use the docs home page's settings" })).toBeChecked();
    expect(screen.queryByLabelText('Name in the top bar')).toBeNull();
  });

  it('shows the fields when inherit is off, and on the home page itself', () => {
    renderSettings(tree({ inherit: false }), 'start');
    expect(screen.getByLabelText('Name in the top bar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add link' })).toBeInTheDocument();
  });
});

describe('inserter and catalog', () => {
  it('never offers the docs frame or the legacy layout as blocks to insert', () => {
    // The shell and page are the fixed frame of every docs page; the docs editor draws them itself.
    for (const mode of ['page', 'docs'] as const) {
      const names = buildBlockLibraryCategories({ mode }).flatMap((group) => group.blocks.map((b) => b.id));
      expect(names).not.toContain('docs/shell');
      expect(names).not.toContain('docs/page');
      expect(names).not.toContain('core/docs-layout');
    }
  });
  it('marks the old layout as legacy and starts a shell with a docs page inside', () => {
    expect(getBlockEntry('core/docs-layout').label).toContain('legacy');
    const children = getBlockEntry('docs/shell').defaultChildren?.({ parentId: 's', newId: (() => { let n = 0; return () => `id${n += 1}`; })() });
    expect(children?.[0].name).toBe('docs/page');
    expect(children?.[0].children?.length).toBeGreaterThan(0);
  });
});
