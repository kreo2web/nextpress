import type { DocsSummary, DocsTree, DocsTreeItem } from '@shared/docs';

/** A docs made from scratch by a test, so no test reads anything it did not set up itself. */
export const docsSummary = (changes: Partial<DocsSummary> = {}): DocsSummary => ({
  homeId: 'home-1',
  siteId: 'site-a',
  name: 'Acme Docs',
  path: '/docs',
  pageCount: 4,
  searchOn: true,
  status: 'publish',
  ...changes,
});

export const treeItem = (changes: Partial<DocsTreeItem> & Pick<DocsTreeItem, 'id' | 'title'>): DocsTreeItem => ({
  slug: changes.id,
  path: `/docs/${changes.id}`,
  parentId: 'home-1',
  menuOrder: 0,
  status: 'publish',
  kind: 'page',
  hidden: false,
  children: [],
  ...changes,
});

/** Acme Docs: a group with a page in it, a hidden page, and the home on top. */
export const docsTree = (): DocsTree => ({
  home: treeItem({
    id: 'home-1',
    title: 'Acme Docs',
    path: '/docs',
    parentId: null,
    children: [
      treeItem({
        id: 'group-1',
        title: 'Getting started',
        kind: 'group',
        children: [treeItem({ id: 'install', title: 'Install', parentId: 'group-1', path: '/docs/getting-started/install' })],
      }),
      treeItem({ id: 'internal', title: 'Internal notes', hidden: true, status: 'draft', menuOrder: 1 }),
    ],
  }),
  settings: {
    title: 'Acme Docs',
    logoUrl: '',
    logoDarkUrl: '',
    links: [],
    button: { label: '', url: '' },
    search: { show: true, label: 'Search', placeholder: 'Search the docs' },
    features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
  },
});
