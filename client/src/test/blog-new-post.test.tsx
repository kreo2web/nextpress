import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWrittenPost } from '@shared/blog/compose-blog-post';
import type { BlockConfig } from '@shared/schema-types';
import { CreatePostDialog } from '@/components/posts/CreatePostDialog';
import { getQueryFn } from '@/lib/queryClient';
import { installFakeFetch, type FakeRoutes } from './fixtures/fake-fetch';

vi.setConfig({ testTimeout: 30_000 });

const setLocation = vi.fn();
vi.mock('wouter', () => ({ useLocation: () => ['/admin/posts', setLocation] }));

const SITE = { id: 'site-a', name: 'Acme', siteUrl: 'https://acme.com', isDefault: true };
vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({ sites: [SITE], activeSiteId: 'site-a', activeSite: SITE, isLoading: false, error: null, setActiveSiteId: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  setLocation.mockClear();
});

const blog = (id: string, name: string) => ({ id, name, slug: id, siteId: 'site-a', status: 'publish', settings: {} });

const renderDialog = (routes: FakeRoutes) => {
  const fake = installFakeFetch(routes);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: 'throw' }) }, mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <CreatePostDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { ...fake, onOpenChange, user: userEvent.setup() };
};

describe('a new blog post', () => {
  it('on a site without a blog: sets one up first, then a title, and the post is only a body that opens in the writing editor', async () => {
    const { user, calls } = renderDialog({
      'GET /api/blogs?*': { json: { blogs: [] } },
      'POST /api/blogs?siteId=site-a': { json: blog('blog-1', 'Field Notes') },
      'POST /api/posts': { json: { id: 'post-1' } },
    });

    expect(await screen.findByRole('dialog', { name: 'Set up your blog' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Field Notes');
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await user.click(screen.getByRole('switch', { name: 'Comments' }));
    await user.click(screen.getByRole('button', { name: 'Set up blog' }));

    const setup = calls.find((call) => call.method === 'POST' && call.url.startsWith('/api/blogs'));
    expect(setup?.body).toMatchObject({
      name: 'Field Notes',
      status: 'publish',
      settings: { post: { comments: false, cover: true } },
      home: { address: 'blog', publish: true, list: { layout: 'list' } },
    });

    await user.type(await screen.findByLabelText('Title'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Create post' }));

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/post/post-1'));
    const created = calls.find((call) => call.method === 'POST' && call.url === '/api/posts');
    expect(created?.body).toMatchObject({ title: 'Hello', blogId: 'blog-1', status: 'draft' });
    expect(isWrittenPost(created?.body?.blocks as BlockConfig[])).toBe(true);
  });

  it('asks which blog only when there are several, and says so when the title is missing', async () => {
    const { user, calls } = renderDialog({
      'GET /api/blogs?*': { json: { blogs: [blog('b-1', 'News'), blog('b-2', 'Engineering')] } },
      'POST /api/posts': { json: { id: 'post-2' } },
    });

    // The dialog says "New blog post" while it checks the blogs too; the title box comes once it knows.
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Create post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the post a title.');

    await user.selectOptions(screen.getByLabelText('Blog'), 'b-2');
    await user.type(screen.getByLabelText('Title'), 'Release notes');
    await user.click(screen.getByRole('button', { name: 'Create post' }));
    await waitFor(() => expect(calls.some((call) => call.url === '/api/posts')).toBe(true));
    expect(calls.find((call) => call.url === '/api/posts')?.body).toMatchObject({ blogId: 'b-2', title: 'Release notes' });
  });
});
