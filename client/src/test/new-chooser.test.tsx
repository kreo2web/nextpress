import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewContentButton } from '@/components/new-content';
import { docsSummary, docsTree } from './fixtures/docs-fixtures';
import { installFakeFetch, type FakeRoutes } from './fixtures/fake-fetch';

// These tests click and type through whole flows. Alone they take 1 to 4 seconds; on a busy machine the 5 second default is too tight.
vi.setConfig({ testTimeout: 30_000 });

const setLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/admin/pages', setLocation],
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
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

vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], posts: [], templates: [], themes: [], isLoading: false }),
}));

vi.mock('@/hooks/use-ai-settings', () => ({
  useAiStatus: () => ({ data: { enabled: false } }),
}));

vi.mock('@/components/posts/CreatePostDialog', () => ({
  CreatePostDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Blog post step" /> : null),
}));

const showSuccessToast = vi.fn();
vi.mock('@/lib/sonner-toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sonner-toast')>()),
  showSuccessToast: (message: string) => showSuccessToast(message),
}));

const docsRoutes = (docs: ReturnType<typeof docsSummary>[]): FakeRoutes => ({
  'GET /api/docs?siteId=site-a': { json: { docs } },
  'GET /api/docs/home-1/tree': { json: docsTree() },
});

const renderButton = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewContentButton variant="header" />
    </QueryClientProvider>,
  );
};

/**
 * Radix moves a radio on the arrow key's way down, one tick later, and forgets the key on its way up. A real
 * key is held long enough; `{ArrowRight}` alone is released first, so the test holds it for a tick.
 */
const pressArrow = async ({ user, key }: { user: ReturnType<typeof userEvent.setup>; key: 'ArrowRight' | 'ArrowLeft' }) => {
  await user.keyboard(`{${key}>}`);
  await user.keyboard(`{/${key}}`);
};

const openChooser = async () => {
  const user = userEvent.setup();
  renderButton();
  await user.click(screen.getByRole('button', { name: 'New' }));
  const dialog = await screen.findByRole('dialog', { name: 'What are you making?' });
  return { user, dialog };
};

describe('New: what are you making?', () => {
  beforeEach(() => {
    setLocation.mockClear();
    showSuccessToast.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens with three cards, Page picked, each with one plain line', async () => {
    installFakeFetch(docsRoutes([]));
    const { dialog } = await openChooser();

    const cards = within(dialog).getAllByRole('radio');
    expect(cards.map((card) => card.getAttribute('aria-labelledby'))).toHaveLength(3);
    expect(within(dialog).getByRole('radio', { name: 'Page' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Blog post' })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Docs page' })).not.toBeChecked();
    expect(within(dialog).getByText('One page you design freely: a landing page, pricing, about.')).toBeInTheDocument();
    expect(within(dialog).getByText('Writing for your blog. How the blog looks is set once.')).toBeInTheDocument();
    expect(within(dialog).getByText('A page in your docs, with its own header, sidebar and search.')).toBeInTheDocument();
  });

  it('moves the pick with the arrow keys, so the cards work without a mouse', async () => {
    installFakeFetch(docsRoutes([]));
    const { user, dialog } = await openChooser();

    // The dialog opens with focus on the picked card, so the keyboard works at once.
    expect(within(dialog).getByRole('radio', { name: 'Page' })).toHaveFocus();
    await pressArrow({ user, key: 'ArrowRight' });
    expect(within(dialog).getByRole('radio', { name: 'Blog post' })).toBeChecked();
    await pressArrow({ user, key: 'ArrowRight' });
    expect(within(dialog).getByRole('radio', { name: 'Docs page' })).toBeChecked();
    await pressArrow({ user, key: 'ArrowLeft' });
    expect(within(dialog).getByRole('radio', { name: 'Blog post' })).toBeChecked();
  });

  it('goes on with Enter on a card, like a form', async () => {
    installFakeFetch(docsRoutes([]));
    const { user, dialog } = await openChooser();

    expect(within(dialog).getByRole('radio', { name: 'Page' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog', { name: 'New page' })).toBeInTheDocument();
  });

  it('Page leads to the short page step: a title and what to start from, nothing else', async () => {
    installFakeFetch(docsRoutes([]));
    const { user } = await openChooser();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const step = await screen.findByRole('dialog', { name: 'New page' });
    expect(within(step).getByLabelText('Title')).toBeInTheDocument();
    expect(within(step).getByText('Start from')).toBeInTheDocument();
    expect(within(step).queryByLabelText(/slug/i)).not.toBeInTheDocument();
    expect(within(step).queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(within(step).queryByLabelText(/parent/i)).not.toBeInTheDocument();
  });

  it('Blog post leads to the existing post flow', async () => {
    installFakeFetch(docsRoutes([]));
    const { user } = await openChooser();

    await user.click(screen.getByRole('radio', { name: 'Blog post' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('dialog', { name: 'Blog post step' })).toBeInTheDocument();
  });

  it('Docs page on a site with no docs says what comes next and goes to setup', async () => {
    installFakeFetch(docsRoutes([]));
    const { user, dialog } = await openChooser();

    await user.click(screen.getByRole('radio', { name: 'Docs page' }));

    expect(
      await within(dialog).findByText(
        'This site has no docs yet. Next you pick a name, where the docs live and what they have. After that, new docs pages only ask for a title.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Set up docs' }));

    const setup = await screen.findByRole('dialog', { name: 'Set up your docs' });
    expect(within(setup).getByRole('heading', { name: 'What are your docs called?' })).toBeInTheDocument();
  });

  it('Docs page on a site with docs asks for a title and where it goes, then opens the editor on the new page', async () => {
    const { callsTo } = installFakeFetch({
      ...docsRoutes([docsSummary()]),
      'POST /api/docs/home-1/items': { status: 201, json: { item: { id: 'new-page', title: 'Install guide' } } },
    });
    const { user, dialog } = await openChooser();

    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    expect(await within(dialog).findByText('Next: a title, and where the page goes in your docs sidebar.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const step = await screen.findByRole('dialog', { name: 'New docs page' });
    const under = await within(step).findByLabelText('Put it under');
    const options = within(under).getAllByRole('option').map((option) => option.textContent?.trim());
    expect(options).toEqual(['Top level of the docs', 'Getting started (group)', 'Install', 'Internal notes (hidden)']);

    await user.type(within(step).getByLabelText('Title'), 'Install guide');
    await user.selectOptions(under, 'group-1');
    await user.click(within(step).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/new-page'));
    expect(callsTo({ method: 'POST', prefix: '/api/docs/home-1/items' })[0]?.body).toEqual({
      parentId: 'group-1',
      title: 'Install guide',
      kind: 'page',
    });
    expect(showSuccessToast).toHaveBeenCalledWith('Docs page created');
  });

  it('puts a new docs page at the top level by default', async () => {
    const { callsTo } = installFakeFetch({
      ...docsRoutes([docsSummary()]),
      'POST /api/docs/home-1/items': { status: 201, json: { item: { id: 'new-page', title: 'Intro' } } },
    });
    const { user, dialog } = await openChooser();
    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    await within(dialog).findByText(/Next: a title/);
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const step = await screen.findByRole('dialog', { name: 'New docs page' });
    await within(step).findByLabelText('Put it under');
    await user.type(within(step).getByLabelText('Title'), 'Intro');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(callsTo({ method: 'POST', prefix: '/api/docs/home-1/items' })).toHaveLength(1));
    expect(callsTo({ method: 'POST', prefix: '/api/docs/home-1/items' })[0]?.body).toMatchObject({ parentId: 'home-1', title: 'Intro' });
  });

  it('asks for a title next to the field when it is empty, and sends nothing', async () => {
    const { callsTo } = installFakeFetch(docsRoutes([docsSummary()]));
    const { user, dialog } = await openChooser();
    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    await within(dialog).findByText(/Next: a title/);
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const step = await screen.findByRole('dialog', { name: 'New docs page' });
    await within(step).findByLabelText('Put it under');
    await user.click(within(step).getByRole('button', { name: 'Create page' }));

    expect(await within(step).findByText('Give the page a title.')).toBeInTheDocument();
    expect(within(step).getByLabelText('Title')).toBeInvalid();
    expect(callsTo({ method: 'POST', prefix: '/api/docs' })).toHaveLength(0);
  });

  it('shows the server\'s plain reason when adding the page fails, and stays open', async () => {
    installFakeFetch({
      ...docsRoutes([docsSummary()]),
      'POST /api/docs/home-1/items': { status: 429, json: { message: 'Too many changes at once. Wait a minute and try again.' } },
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, dialog } = await openChooser();
    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    await within(dialog).findByText(/Next: a title/);
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const step = await screen.findByRole('dialog', { name: 'New docs page' });
    await within(step).findByLabelText('Put it under');
    await user.type(within(step).getByLabelText('Title'), 'Intro');
    await user.click(within(step).getByRole('button', { name: 'Create page' }));

    expect(await within(step).findByText('Too many changes at once. Wait a minute and try again.')).toBeInTheDocument();
    expect(setLocation).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ atFunction: 'NewDocsPageDialog.create', data: expect.objectContaining({ homeId: 'home-1', parentId: 'home-1' }) }),
    );
    errors.mockRestore();
  });

  it('waits while it checks for docs, and says so', async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    installFakeFetch({ 'GET /api/docs?siteId=site-a': () => gate.then(() => ({ json: { docs: [] } })) });
    const { user, dialog } = await openChooser();

    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    expect(within(dialog).getByText('Checking your docs…')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();

    finish();
    expect(await within(dialog).findByRole('button', { name: 'Set up docs' })).toBeEnabled();
  });

  it('says when it could not check for docs, and offers to try again', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let attempts = 0;
    installFakeFetch({
      'GET /api/docs?siteId=site-a': () => (++attempts === 1 ? { status: 500, json: { message: "Couldn't finish that. Please try again." } } : { json: { docs: [] } }),
    });
    const { user, dialog } = await openChooser();

    await user.click(screen.getByRole('radio', { name: 'Docs page' }));
    expect(await within(dialog).findByText(/We couldn't check your docs\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByRole('button', { name: 'Set up docs' })).toBeEnabled();
    errors.mockRestore();
  });

  it('closes with Cancel and starts fresh the next time', async () => {
    installFakeFetch(docsRoutes([]));
    const { user, dialog } = await openChooser();
    await user.click(screen.getByRole('radio', { name: 'Blog post' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'New' }));
    const again = await screen.findByRole('dialog', { name: 'What are you making?' });
    expect(within(again).getByRole('radio', { name: 'Page' })).toBeChecked();
  });
});
