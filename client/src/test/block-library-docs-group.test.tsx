import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getBlockEntry, type BlockName } from '@shared/block-catalog';
import { DragDropContext } from '@/lib/dnd';

// Load the renderer entry first: the renderer modules import each other through the block table.
await import('../../../renderer/react/render-helpers');
const { default: BlockLibrary, buildBlockLibraryCategories } = await import('@/components/PageBuilder/BlockLibrary');

const DOCS_BLOCKS: BlockName[] = ['docs/callout', 'docs/code-group', 'docs/file-tree', 'docs/params', 'docs/example', 'docs/diagram', 'docs/update'];
const ALSO_IN_DOCS: BlockName[] = [
  'core/code',
  'core/image',
  'core/table',
  'core/tabs',
  'core/steps',
  'core/grid',
  'core/accordion',
  'core/separator',
  'core/markdown',
];

/** The docs editor's inserter holds the Docs group; the page builder's library never does. */
const docsGroups = () => buildBlockLibraryCategories({ mode: 'docs' });
const pageGroups = () => buildBlockLibraryCategories();
const docsBlockIds = (): string[] => docsGroups().find((group) => group.id === 'docs')?.blocks.map((block) => block.id) ?? [];
const idsIn = (groupId: string): string[] =>
  pageGroups()
    .find((group) => group.id === groupId)
    ?.blocks.map((block) => block.id) ?? [];

describe('block library: the Docs group', () => {
  it('is the docs inserter\'s one group, named Docs, and the page builder never shows it', () => {
    expect(docsGroups().map((group) => group.id)).toEqual(['docs']);
    expect(docsGroups()[0].name).toBe('Docs');
    expect(pageGroups().map((group) => group.id)).not.toContain('docs');
  });

  it('lists the docs blocks first, then the core blocks that list themselves there', () => {
    const docsGroup = docsBlockIds();
    const ownCount = docsGroup.filter((id) => id.startsWith('docs/')).length;
    expect(docsGroup.slice(0, ownCount).every((id) => id.startsWith('docs/'))).toBe(true);
    expect(docsGroup).toEqual(expect.arrayContaining([...DOCS_BLOCKS, ...ALSO_IN_DOCS]));
    expect(docsGroup.slice(ownCount).sort()).toEqual(expect.arrayContaining([...ALSO_IN_DOCS].sort()));
  });

  it('shows each block once in the group', () => {
    const docsGroup = docsBlockIds();
    expect(new Set(docsGroup).size).toBe(docsGroup.length);
  });

  it.each(ALSO_IN_DOCS)('keeps %s in its own group as well', (name) => {
    const home = getBlockEntry(name).category;
    expect(home).not.toBe('docs');
    expect(idsIn(home)).toContain(name);
    expect(docsBlockIds()).toContain(name);
  });

  it('never lists a docs block in a page group', () => {
    for (const group of pageGroups()) {
      expect(group.blocks.filter((block) => block.id.startsWith('docs/')).map((block) => block.id)).toEqual([]);
    }
  });
});

const renderLibrary = (categories?: ReturnType<typeof buildBlockLibraryCategories>) =>
  render(
    <DragDropContext onDragEnd={() => {}}>
      <BlockLibrary categories={categories} />
    </DragDropContext>,
  );

const groupOf = (container: HTMLElement, groupId: string): HTMLElement => {
  const group = container.querySelector<HTMLElement>(`[data-rfd-droppable-id="block-library-${groupId}"]`);
  if (!group) throw new Error(`no library group "${groupId}"`);
  return group;
};

describe('<BlockLibrary /> with the Docs group', () => {
  it('shows a Docs heading and the docs blocks and borrowed core blocks under it', () => {
    const { container } = renderLibrary(docsGroups());
    expect(screen.getByRole('button', { name: 'Docs' })).toBeInTheDocument();

    const docs = within(groupOf(container, 'docs'));
    for (const label of ['Callout', 'Code group', 'File tree', 'Parameters', 'Code example', 'Diagram', 'Changelog entry']) {
      expect(docs.getByText(label)).toBeInTheDocument();
    }
    for (const label of ['Image', 'Separator', 'Accordion', 'Code', 'Table', 'Markdown', 'Grid', 'Steps', 'Tabs']) {
      expect(docs.getByText(label)).toBeInTheDocument();
    }
  });

  it('still shows the borrowed core blocks in their own groups', () => {
    const { container } = renderLibrary();
    expect(within(groupOf(container, 'media')).getByText('Image')).toBeInTheDocument();
    expect(within(groupOf(container, 'advanced')).getByText('Code')).toBeInTheDocument();
    expect(within(groupOf(container, 'layout')).getByText('Grid')).toBeInTheDocument();
    expect(within(groupOf(container, 'advanced')).queryByText('Callout')).not.toBeInTheDocument();
  });

  it('searching "docs" lists the Docs group and does not repeat its borrowed blocks in their own groups', () => {
    const { container } = renderLibrary(docsGroups());
    fireEvent.change(screen.getByLabelText('Search blocks'), { target: { value: 'docs' } });

    const docs = within(groupOf(container, 'docs'));
    expect(docs.getByText('Callout')).toBeInTheDocument();
    expect(docs.getByText('Image')).toBeInTheDocument();
    expect(screen.getAllByText('Image')).toHaveLength(1);
    expect(screen.getAllByText('Code')).toHaveLength(1);
  });
});
