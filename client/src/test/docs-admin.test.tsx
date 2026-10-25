import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import Docs from '@/pages/Docs';
import { docsSummary, docsTree } from './fixtures/docs-fixtures';
import { installFakeFetch, type FakeRoutes } from './fixtures/fake-fetch';

// These tests click and type through whole flows. Alone they take 1 to 4 seconds; on a busy machine the 5 second default is too tight.
vi.setConfig({ testTimeout: 30_000 });

const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/admin/docs', setLocation],
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode; 'aria-label'?: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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
}));

vi.mock('@/hooks/use-site-access', () => ({
  useSiteAccess: () => ({ access: null, isLoading: false, isMainSiteAdmin: true, can: () => true }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], posts: [], templates: [], themes: [], isLoading: false }),
}));
vi.mock('@/hooks/use-ai-settings', () => ({ useAiStatus: () => ({ data: { enabled: false } }) }));
vi.mock('@/components/posts/CreatePostDialog', () => ({ CreatePostDialog: () => null }));

const showSuccessToast = vi.fn();
vi.mock('@/lib/sonner-toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sonner-toast')>()),
  showSuccessToast: (message: string) => showSuccessToast(message),
}));

const NO_HOMEPAGE: FakeRoutes = { 'GET /api/options/homepage_page_slug?siteId=site-a': { status: 404, json: { message: 'Option not found' } } };

const routes = (docs: ReturnType<typeof docsSummary>[], more: FakeRoutes = {}): FakeRoutes => ({
  'GET /api/docs?siteId=site-a': { json: { docs } },
  'GET /api/docs/home-1/tree': { json: docsTree() },
  ...NO_HOMEPAGE,
  ...more,
});

const renderScreen = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Docs />
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
};

const card = async (name = 'Acme Docs') => screen.findByRole('region', { name });

describe('Docs screen', () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    setLocation.mockClear();
    showSuccessToast.mockClear();
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('each docs', () => {
    it('is one surface with its name, status, address, search, page count and actions', async () => {
      installFakeFetch(routes([docsSummary()]));
      renderScreen();

      const docs = await card();
      expect(within(docs).getByRole('heading', { name: 'Acme Docs', level: 2 })).toBeInTheDocument();
      expect(within(docs).getByText('Published')).toBeInTheDocument();
      const address = within(docs).getByRole('link', { name: /acme\.com\/docs/ });
      expect(address).toHaveAttribute('href', 'https://acme.com/docs');
      expect(address).toHaveAttribute('target', '_blank');
      expect(within(docs).getByText('Search').nextSibling).toHaveTextContent('On');
      expect(within(docs).getByText('Pages').nextSibling).toHaveTextContent('4');
      expect(within(docs).getByRole('link', { name: 'Open editor for Acme Docs' })).toHaveAttribute('href', '/admin/page-builder/page/home-1');
      expect(within(docs).getByRole('button', { name: 'New docs page for Acme Docs' })).toBeInTheDocument();
      expect(within(docs).getByRole('button', { name: 'Export docs for Acme Docs' })).toBeInTheDocument();
    });

    it('says search is off, and does not link a docs that is still a draft', async () => {
      installFakeFetch(routes([docsSummary({ searchOn: false, status: 'draft' })]));
      renderScreen();

      const docs = await card();
      expect(within(docs).getByText('Search').nextSibling).toHaveTextContent('Off');
      expect(within(docs).getByText('Draft')).toBeInTheDocument();
      expect(within(docs).getByText('acme.com/docs')).toBeInTheDocument();
      expect(within(docs).queryByRole('link', { name: /acme\.com\/docs/ })).not.toBeInTheDocument();
    });

    it('shows the site address alone when the docs are the site homepage (docs on their own address)', async () => {
      installFakeFetch(
        routes([docsSummary()], {
          'GET /api/options/homepage_page_slug?siteId=site-a': { json: { name: 'homepage_page_slug', value: 'docs' } },
        }),
      );
      renderScreen();

      const docs = await card();
      await waitFor(() => expect(within(docs).getByRole('link', { name: /^acme\.com/ })).toHaveAttribute('href', 'https://acme.com'));
    });

    it('lists several docs, one surface each', async () => {
      installFakeFetch(
        routes([docsSummary(), docsSummary({ homeId: 'home-2', name: 'API reference', path: '/api-docs' })], {
          'GET /api/docs/home-2/tree': { json: { ...docsTree(), home: { ...docsTree().home, id: 'home-2', title: 'API reference' } } },
        }),
      );
      renderScreen();

      expect(await card('Acme Docs')).toBeInTheDocument();
      expect(await card('API reference')).toBeInTheDocument();
    });
  });

  describe('the pages of a docs', () => {
    it('shows groups as labels, pages that open in the editor, and hidden pages marked', async () => {
      installFakeFetch(routes([docsSummary()]));
      renderScreen();

      const pages = await screen.findByRole('region', { name: 'Pages of Acme Docs' });
      expect(within(pages).getByText('Docs home')).toBeInTheDocument();
      expect(within(pages).getByRole('link', { name: 'Acme Docs' })).toHaveAttribute('href', '/admin/page-builder/page/home-1');

      const group = within(pages).getByText('Getting started');
      expect(group.closest('a')).toBeNull();
      expect(within(pages).getByText('Group')).toBeInTheDocument();
      expect(within(pages).getByRole('link', { name: 'Install' })).toHaveAttribute('href', '/admin/page-builder/page/install');

      const hiddenRow = within(pages).getByRole('link', { name: 'Internal notes' }).parentElement as HTMLElement;
      expect(within(hiddenRow).getByText('Hidden')).toBeInTheDocument();
      expect(within(hiddenRow).getByText('Draft')).toBeInTheDocument();
      expect(within(pages).getAllByText('Hidden')).toHaveLength(1);
    });

    it('says so, with a way to try again, when the pages cannot be loaded', async () => {
      let asked = 0;
      installFakeFetch(
        routes([docsSummary()], {
          'GET /api/docs/home-1/tree': () => (++asked === 1 ? { status: 500, json: { message: "Couldn't finish that. Please try again." } } : { json: docsTree() }),
        }),
      );
      const { user } = renderScreen();

      const docs = await card();
      expect(await within(docs).findByText(/We couldn't load the pages\./)).toBeInTheDocument();
      await user.click(within(docs).getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('region', { name: 'Pages of Acme Docs' })).toBeInTheDocument();
    });
  });

  describe('export docs', () => {
    let downloads: string[];
    let clicked: MockInstance<typeof HTMLAnchorElement.prototype.click>;

    beforeEach(() => {
      downloads = [];
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:docs'), revokeObjectURL: vi.fn() }));
      clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    });
    afterEach(() => clicked.mockRestore());

    const exportRoute = (filename = 'docs-docs.nextpress-page.json'): FakeRoutes => ({
      'GET /api/docs/home-1/export?files=*': {
        body: '{"pages":[]}',
        headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${filename}"` },
      },
    });

    it('opens a small dialog with images and files included, and downloads the file under the name the server gave', async () => {
      const { callsTo } = installFakeFetch(routes([docsSummary()], exportRoute()));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Export docs for Acme Docs' }));
      const dialog = await screen.findByRole('dialog', { name: 'Export docs' });
      expect(within(dialog).getByRole('switch', { name: 'Include images and files' })).toBeChecked();
      expect(within(dialog).getByText('The docs arrive complete. Larger file.')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Download file' }));

      await waitFor(() => expect(downloads).toEqual(['docs-docs.nextpress-page.json']));
      expect(callsTo({ method: 'GET', prefix: '/api/docs/home-1/export' }).map((call) => call.url)).toEqual(['/api/docs/home-1/export?files=1']);
      expect(showSuccessToast).toHaveBeenCalledWith('Docs file downloaded');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Export docs' })).not.toBeInTheDocument());
    });

    it('leaves images and files out when the switch is turned off', async () => {
      const { callsTo } = installFakeFetch(routes([docsSummary()], exportRoute('help-docs.nextpress-page.json')));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Export docs for Acme Docs' }));
      const dialog = await screen.findByRole('dialog', { name: 'Export docs' });
      await user.click(within(dialog).getByRole('switch', { name: 'Include images and files' }));
      expect(within(dialog).getByText('Small file. Each image or file becomes a named placeholder to swap later.')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Download file' }));

      await waitFor(() => expect(downloads).toEqual(['help-docs.nextpress-page.json']));
      expect(callsTo({ method: 'GET', prefix: '/api/docs/home-1/export' })[0]?.url).toBe('/api/docs/home-1/export?files=0');
    });

    it('names the file after the docs address if the server sends no name', async () => {
      installFakeFetch(routes([docsSummary({ path: '/guides' })], { 'GET /api/docs/home-1/export?files=*': { body: '{}' } }));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Export docs for Acme Docs' }));
      const dialog = await screen.findByRole('dialog', { name: 'Export docs' });
      await user.click(within(dialog).getByRole('button', { name: 'Download file' }));

      await waitFor(() => expect(downloads).toEqual(['guides-docs.nextpress-page.json']));
    });

    it('stays open with the reason in plain words when the file cannot be made', async () => {
      installFakeFetch(routes([docsSummary()], { 'GET /api/docs/home-1/export?files=*': { status: 404, json: { message: 'These docs no longer exist.' } } }));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Export docs for Acme Docs' }));
      const dialog = await screen.findByRole('dialog', { name: 'Export docs' });
      await user.click(within(dialog).getByRole('button', { name: 'Download file' }));

      expect(await within(dialog).findByText('These docs no longer exist.')).toBeInTheDocument();
      expect(downloads).toEqual([]);
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({ atFunction: 'ExportDocsDialog.download', data: expect.objectContaining({ homeId: 'home-1', siteId: 'site-a' }) }),
      );
    });
  });

  describe('new docs page', () => {
    it('opens the docs step for that docs: a title and where it goes, with no "which docs" question', async () => {
      installFakeFetch(routes([docsSummary(), docsSummary({ homeId: 'home-2', name: 'API reference' })], { 'GET /api/docs/home-2/tree': { json: docsTree() } }));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'New docs page for Acme Docs' }));

      const dialog = await screen.findByRole('dialog', { name: 'New docs page' });
      expect(await within(dialog).findByLabelText('Put it under')).toBeInTheDocument();
      expect(within(dialog).queryByLabelText('Docs')).not.toBeInTheDocument();
    });
  });

  describe('when there are no docs', () => {
    it('says so in one line and offers "Set up docs", which opens the setup', async () => {
      installFakeFetch(routes([]));
      const { user } = renderScreen();

      expect(await screen.findByText('No docs on this site yet.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Set up docs' }));

      expect(await screen.findByRole('dialog', { name: 'Set up your docs' })).toBeInTheDocument();
    });
  });

  describe('loading and failing', () => {
    it('shows the shape of a docs while it loads', async () => {
      let finish: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (finish = resolve));
      installFakeFetch(routes([], { 'GET /api/docs?siteId=site-a': () => gate.then(() => ({ json: { docs: [] } })) }));
      renderScreen();

      expect(screen.getByRole('status', { name: 'Loading docs' })).toBeInTheDocument();
      finish();
      expect(await screen.findByText('No docs on this site yet.')).toBeInTheDocument();
    });

    it('says it could not load the docs, and tries again on request', async () => {
      let asked = 0;
      installFakeFetch(
        routes([docsSummary()], {
          'GET /api/docs?siteId=site-a': () => (++asked === 1 ? { status: 500, json: { message: 'nope' } } : { json: { docs: [docsSummary()] } }),
        }),
      );
      const { user } = renderScreen();

      expect(await screen.findByText(/We couldn't load your docs\./)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await card()).toBeInTheDocument();
    });
  });

  describe('New', () => {
    it('is in the page header and opens "What are you making?"', async () => {
      installFakeFetch(routes([docsSummary()]));
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'New' }));

      const dialog = await screen.findByRole('dialog', { name: 'What are you making?' });
      expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    });
  });
});
