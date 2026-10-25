import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminTopBar from '@/components/AdminTopBar';
import Pages from '@/pages/Pages';
import { getQueryFn } from '@/lib/queryClient';
import { installFakeFetch, type FakeRoutes } from './fixtures/fake-fetch';

// These tests click and type through whole flows. Alone they take 1 to 4 seconds; on a busy machine the 5 second default is too tight.
vi.setConfig({ testTimeout: 30_000 });

const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/admin/pages', setLocation],
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/AdminLayout', () => ({
  AdminLayout: ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <div>{actions}</div>
      {children}
    </div>
  ),
}));

const SITES = [{ id: 'site-a', name: 'Acme', siteUrl: 'https://acme.com', isDefault: true }];
vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({
    sites: SITES,
    activeSiteId: 'site-a',
    activeSite: SITES[0],
    isLoading: false,
    error: null,
    setActiveSiteId: vi.fn(),
    formatSiteLabel: (site: { name: string }) => site.name,
  }),
  useOptionalActiveSite: () => null,
}));

const rights = { editContent: true };
vi.mock('@/hooks/use-site-access', () => ({
  useSiteAccess: () => ({
    access: null,
    isLoading: false,
    isMainSiteAdmin: true,
    can: (action: string) => (action === 'edit_content' ? rights.editContent : true),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1', firstName: 'Ada', username: 'ada' } }) }));
vi.mock('@/components/ThemeProvider', () => ({ useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }) }));
vi.mock('@/components/SiteSwitcher', () => ({ SiteSwitcher: () => null }));
vi.mock('@/components/account/change-password-dialog', () => ({ ChangePasswordDialog: () => null }));
vi.mock('@/components/account/use-account-profile', () => ({ getAccountInitials: () => 'A' }));
vi.mock('@/components/account/sign-out', () => ({ signOutAndLeave: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], posts: [], templates: [], themes: [], isLoading: false }),
}));
vi.mock('@/hooks/use-ai-settings', () => ({ useAiStatus: () => ({ data: { enabled: false } }) }));
vi.mock('@/components/posts/CreatePostDialog', () => ({ CreatePostDialog: () => null }));

const emptyPages: FakeRoutes = {
  'GET /api/pages?*': { json: { pages: [], total: 0, page: 1, per_page: 10, total_pages: 0 } },
  'GET /api/options/homepage_page_slug?siteId=site-a': { status: 404, json: { message: 'Option not found' } },
  'GET /api/docs?siteId=site-a': { json: { docs: [] } },
};

const renderWithQueries = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: 'throw' }) }, mutations: { retry: false } },
  });
  return { ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>), user: userEvent.setup() };
};

describe('where "New" opens "What are you making?"', () => {
  beforeEach(() => {
    setLocation.mockClear();
    rights.editContent = true;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('from the admin top bar', async () => {
    installFakeFetch(emptyPages);
    const { user } = renderWithQueries(<AdminTopBar />);

    await user.click(screen.getByRole('button', { name: 'New' }));

    const dialog = await screen.findByRole('dialog', { name: 'What are you making?' });
    expect(within(dialog).getAllByRole('radio').map((radio) => radio.id)).toEqual(['new-kind-page', 'new-kind-post', 'new-kind-docs']);
  });

  it('only for people who can make content', () => {
    rights.editContent = false;
    installFakeFetch(emptyPages);
    renderWithQueries(<AdminTopBar />);

    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument();
  });

  it('from the Pages screen header, in place of "Add New Page"', async () => {
    installFakeFetch(emptyPages);
    const { user } = renderWithQueries(<Pages />);

    expect(screen.queryByRole('button', { name: /add new page/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'New' }));

    expect(await screen.findByRole('dialog', { name: 'What are you making?' })).toBeInTheDocument();
  });

  it('keeps "Create your first page" on the Pages screen going straight to the short page step', async () => {
    installFakeFetch(emptyPages);
    const { user } = renderWithQueries(<Pages />);

    await user.click(await screen.findByRole('button', { name: 'Create your first page' }));

    const step = await screen.findByRole('dialog', { name: 'New page' });
    expect(within(step).getByLabelText('Title')).toBeInTheDocument();
  });

  it('keeps the /admin/pages?create=true&title=… link opening the short page step with that title', async () => {
    window.history.replaceState({}, '', '/admin/pages?create=true&title=Contact');
    installFakeFetch(emptyPages);
    renderWithQueries(<Pages />);

    const step = await screen.findByRole('dialog', { name: 'New page' });
    await waitFor(() => expect(within(step).getByLabelText('Title')).toHaveValue('Contact'));
    expect(setLocation).toHaveBeenCalledWith('/admin/pages?title=Contact', { replace: true });
  });
});
