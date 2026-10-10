import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PreviewPage from '@/pages/PreviewPage';
import { getQueryFn } from '@/lib/queryClient';

const PAGE = {
  id: 'page-1',
  title: 'Spring sale',
  slug: 'spring-sale',
  siteId: 'site-shop',
  status: 'draft',
  blocks: [
    {
      id: 'h1',
      name: 'core/heading',
      type: 'block',
      parentId: null,
      content: { kind: 'text', value: 'Hello visitors', level: 1 },
    },
  ],
  other: {},
};

describe('share-link preview for a visitor who is not signed in', () => {
  const requested: string[] = [];

  beforeEach(() => {
    requested.length = 0;
    window.history.pushState({}, '', '/preview/page/page-1?token=npt_share');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requested.push(url);
        if (url.startsWith('/api/public/site-theme')) {
          return new Response(JSON.stringify({ themeId: null, settings: {} }), { status: 200 });
        }
        return new Response(JSON.stringify(PAGE), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders outside the admin (no site picker) and paints with the page's own site theme", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: 'throw' }) } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PreviewPage postId="page-1" type="page" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Hello visitors')).toBeInTheDocument();
    expect(requested).toContain('/api/preview/shared/page/page-1?token=npt_share');
    expect(requested).toContain('/api/public/site-theme?siteId=site-shop');
  });
});
