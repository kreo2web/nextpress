import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  listEditorEntityQueryKeys,
  readEditorSaveVersion,
  writeEditorEntityCache,
} from '@/lib/editor-entity-cache';

describe('editor entity cache', () => {
  it('covers the id, the name, and the address used to open the page', () => {
    expect(
      listEditorEntityQueryKeys({
        apiBase: '/api/pages',
        id: 'page-id',
        slug: 'walkableca',
        address: 'walkableca',
      }),
    ).toEqual([['/api/pages/page-id'], ['/api/pages/walkableca']]);
  });

  it('writes the entity under every key, including the site-scoped key of a page opened by name', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['/api/pages/walkableca', { siteId: 'site-b' }], { version: 3 });
    writeEditorEntityCache({
      queryClient,
      keys: [['/api/pages/page-id'], ['/api/pages/walkableca']],
      entity: { version: 4 },
    });
    expect(queryClient.getQueryData(['/api/pages/page-id'])).toEqual({ version: 4 });
    expect(queryClient.getQueryData(['/api/pages/walkableca'])).toEqual({ version: 4 });
    expect(queryClient.getQueryData(['/api/pages/walkableca', { siteId: 'site-b' }])).toEqual({ version: 4 });
  });

  it('saves with the editor version, not a leftover query row', () => {
    expect(
      readEditorSaveVersion({
        pageVersion: 6,
        fallback: { version: 3 },
      }),
    ).toBe(6);
    expect(
      readEditorSaveVersion({
        inlinePost: { version: 2 },
        pageVersion: 6,
        fallback: { version: 1 },
      }),
    ).toBe(2);
  });
});
