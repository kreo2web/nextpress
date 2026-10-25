import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOCK_CATALOG } from '@shared/block-catalog';
import { buildBlockLibraryCategories, DOCS_FRAME_BLOCKS } from '@/components/PageBuilder/BlockLibrary';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { docsBlockLabel, groupDocsBlocks, searchDocsBlocks } from '@/components/PageBuilder/docs-mode/docs-library';
import { docsPageBlocks, makePage, renderEditor, SITE_ID } from './docs-editor-harness';

vi.setConfig({ testTimeout: 30_000 });
vi.mock('@/hooks/usePageSave', () => ({ usePageSave: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], templates: [], posts: [], pagesLoading: false, templatesLoading: false, postsLoading: false }),
}));
vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({ activeSiteId: SITE_ID, sites: [] }),
  useOptionalActiveSite: () => ({ activeSiteId: SITE_ID, sites: [] }),
}));
vi.mock('@/components/PageBuilder/EditorBar/BlogMenu', () => ({ BlogMenu: () => null }));
vi.mock('@/components/PageBuilder/EditorBar/PagesMenu', () => ({ PagesMenu: () => null }));
vi.mock('@/components/PageBuilder/EditorBar/DesignMenu', () => ({ DesignMenu: () => null }));
vi.mock('@/components/PageBuilder/PublishBlockStyles', () => ({ PublishBlockStyles: () => null }));

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The docs group as the shared catalog states it: blocks of the `docs` category and blocks that list themselves in it, minus the frame. */
const catalogDocsGroup = (): string[] =>
  BLOCK_CATALOG.filter((entry) => entry.category === 'docs' || entry.alsoIn?.includes('docs'))
    .map((entry) => entry.name as string)
    .filter((name) => !DOCS_FRAME_BLOCKS.has(name) && name in blockRegistry);

describe('the library builder', () => {
  it('lists exactly the docs group, and only that, for the docs editor', () => {
    const groups = buildBlockLibraryCategories({ mode: 'docs' });

    expect(groups.map((group) => group.id)).toEqual(['docs']);
    expect(groups[0].blocks.map((block) => block.id).sort()).toEqual(catalogDocsGroup().sort());
  });

  it('never offers the docs frame (page shell, docs shell, docs page), in either editor', () => {
    const everywhere = [...buildBlockLibraryCategories({ mode: 'docs' }), ...buildBlockLibraryCategories({ mode: 'page' })].flatMap((group) => group.blocks.map((block) => block.id));

    for (const frame of ['docs/shell', 'docs/page', 'core/docs-layout']) expect(everywhere).not.toContain(frame);
  });

  it('keeps the Docs group and every docs block out of the page builder', () => {
    const groups = buildBlockLibraryCategories({ mode: 'page' });
    const names = groups.flatMap((group) => group.blocks.map((block) => block.id));

    expect(groups.map((group) => group.id)).not.toContain('docs');
    expect(names.filter((name) => name.startsWith('docs/'))).toEqual([]);
    expect(buildBlockLibraryCategories().map((group) => group.id)).toEqual(groups.map((group) => group.id));
  });
});

describe('the docs sections', () => {
  const blocks = buildBlockLibraryCategories({ mode: 'docs' })[0].blocks;

  it('puts every docs block in exactly one section, in a fixed order', () => {
    const sections = groupDocsBlocks(blocks);
    const placed = sections.flatMap((section) => section.blocks.map((block) => block.id));

    expect(placed.sort()).toEqual(blocks.map((block) => block.id).sort());
    expect(new Set(placed).size).toBe(placed.length);
    expect(sections.map((section) => section.id)).toEqual(expect.arrayContaining(['writing', 'callouts', 'code', 'structure']));
    expect(sections[0].id).toBe('writing');
  });

  it('shows a block nobody sorted yet under More, so a new docs block is usable at once', () => {
    const unsorted = { ...blocks[0], id: 'docs/brand-new', label: 'Brand new' };
    const sections = groupDocsBlocks([...blocks, unsorted]);

    expect(sections[sections.length - 1]).toMatchObject({ id: 'more' });
    expect(sections[sections.length - 1].blocks.map((block) => block.id)).toContain('docs/brand-new');
  });

  it('uses the short names of the mockup and finds blocks by name or description', () => {
    const heading = blocks.find((block) => block.id === 'docs/heading')!;
    expect(docsBlockLabel(heading)).toBe('Heading');
    expect(searchDocsBlocks({ blocks, query: 'callout' }).map((block) => block.id)).toContain('docs/callout');
    expect(searchDocsBlocks({ blocks, query: '  ' })).toHaveLength(blocks.length);
    expect(searchDocsBlocks({ blocks, query: 'zzzz nothing' })).toEqual([]);
  });
});

describe('the inserter in the docs editor', () => {
  it('shows the docs group in sections, and no block outside it', async () => {
    renderEditor({ page: makePage({ id: 'p-docs', blocks: docsPageBlocks() }) });
    const library = await screen.findByTestId('docs-block-library');

    const shown = within(library)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim());
    const expected = buildBlockLibraryCategories({ mode: 'docs' })[0].blocks.map((block) => docsBlockLabel(block));
    expect(shown.sort()).toEqual(expected.sort());
    for (const outside of ['Button', 'Columns', 'Form', 'Spacer', 'Docs shell', 'Docs page', 'Post title', 'Header']) {
      expect(shown).not.toContain(outside);
    }
    for (const section of ['Writing', 'Callouts', 'Code', 'Structure']) {
      expect(within(library).getByRole('region', { name: section })).toBeInTheDocument();
    }
  });

  it('narrows to the blocks that match what is typed, and says so when none do', async () => {
    const { user } = renderEditor({ page: makePage({ id: 'p-docs', blocks: docsPageBlocks() }) });
    const library = await screen.findByTestId('docs-block-library');

    await user.type(within(library).getByLabelText('Find a docs block'), 'table');
    // Buttons by their names: the clear button has only an aria-label.
    const names = within(library).getAllByRole('button').map((button) => button.getAttribute('aria-label') || button.textContent?.trim());
    expect(names.sort()).toEqual(['Clear search', 'Table']);

    await user.clear(within(library).getByLabelText('Find a docs block'));
    await user.type(within(library).getByLabelText('Find a docs block'), 'zzzz');
    expect(within(library).getByText(/No docs block matches/)).toBeInTheDocument();
  });

  it('adds a block when it is clicked, so the keyboard can add blocks too, and picks it', async () => {
    const { user } = renderEditor({ page: makePage({ id: 'p-docs', blocks: docsPageBlocks() }) });
    const library = await screen.findByTestId('docs-block-library');
    expect(document.querySelector('.wp-block-callout')).toBeNull();

    await user.click(within(library).getByRole('button', { name: 'Callout' }));

    await waitFor(() => expect(document.querySelector('.wp-block-callout')).not.toBeNull());
    expect(screen.getByRole('tab', { name: 'Block', selected: true })).toBeInTheDocument();
  });

  it('lets a block be dragged into the page column but not into the frame around it', async () => {
    renderEditor({ page: makePage({ id: 'p-docs', blocks: docsPageBlocks() }) });
    const library = await screen.findByTestId('docs-block-library');
    const handle = within(library).getByRole('button', { name: 'Callout' });
    const droppable = (name: string) => {
      const frameBlock = document.querySelector(`.wp-block-${name}`);
      if (!frameBlock) throw new Error(`no ${name} on the canvas`);
      return frameBlock.querySelector<HTMLElement>('[data-rfd-droppable-id]');
    };
    const dragOnto = (target: Element | null) => {
      if (!target) throw new Error('nothing to drop on');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);
      fireEvent.mouseDown(handle, { clientX: 5, clientY: 5 });
      fireEvent.mouseMove(document, { clientX: 300, clientY: 300 });
      fireEvent.mouseUp(document, { clientX: 300, clientY: 300 });
    };

    // The docs shell holds the docs page: dropping on it would put a block beside the page, so it takes nothing.
    const shellColumn = document.querySelector<HTMLElement>('.wp-block-docs-shell [data-rfd-droppable-id]');
    dragOnto(shellColumn);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.wp-block-callout')).toBeNull();

    // The docs page's column takes it.
    dragOnto(droppable('docs-page') ?? null);
    await waitFor(() => expect(document.querySelector('.wp-block-callout')).not.toBeNull());
  });
});
