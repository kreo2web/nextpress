import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { DocsSetupModal } from '@/components/new-content';
import type { FakeRoutes } from './fake-fetch';

/** What the docs setup tests share: the sites on screen, what the screen reports, and how it is drawn. */

/** The spies behind the mocked wouter, active-site and toast hooks. */
export const setupSpies = { setLocation: vi.fn(), setActiveSiteId: vi.fn(), toast: vi.fn() };

/** What the signed-in person may do; a test turns `mainSiteAdmin` off to see the setup without it. */
export const setupAccess = { mainSiteAdmin: true };

/** Acme (the site being worked on) and a second site that already uses help.acme.com. */
export const SETUP_SITES = [
  { id: 'site-a', name: 'Acme', siteUrl: 'https://www.acme.com', isDefault: true },
  { id: 'site-b', name: 'Help center', siteUrl: 'https://help.acme.com', isDefault: false },
];

export const resetSetupState = (): void => {
  setupSpies.setLocation.mockClear();
  setupSpies.setActiveSiteId.mockClear();
  setupSpies.toast.mockClear();
  setupAccess.mainSiteAdmin = true;
};

export const createdDocs = (siteId: string, path = '/docs') => ({
  status: 201,
  json: {
    homeId: 'home-9',
    docs: { homeId: 'home-9', siteId, name: 'Acme Docs', path, pageCount: 1, searchOn: true, status: 'draft' },
  },
});

export const notPointingHere = {
  status: true,
  data: {
    normalizedInput: 'docs.acme.com',
    checkedHostnames: ['docs.acme.com'],
    dns: { 'docs.acme.com': { ok: false, addresses: [], message: 'Domain does not resolve (no A record yet)' } },
    ipMatch: { ok: false, skipped: false, expectedIp: '203.0.113.10', message: 'Cannot verify IP match until DNS resolves for docs.acme.com.' },
    caddy: { ok: false, message: 'Caddy or upstream returned HTTP 502 (Host: docs.acme.com)' },
  },
};

export const ownAddressRoutes = (overrides: FakeRoutes = {}): FakeRoutes => ({
  'GET /api/setup/verify-domain?q=docs.acme.com': { json: notPointingHere },
  'POST /api/sites': { status: 201, json: { site: { id: 'site-new', name: 'Acme Docs', siteUrl: null, isDefault: false }, notice: null } },
  'POST /api/docs': createdDocs('site-new'),
  'POST /api/options?siteId=site-new': { json: { name: 'homepage_page_slug', value: 'docs' } },
  'PATCH /api/sites/site-new': {
    status: 400,
    json: { message: 'Domain "docs.acme.com" does not resolve. Please point your DNS A record to this server before configuring.' },
  },
  'GET /api/sites': { json: { sites: SETUP_SITES, total: 2 } },
  ...overrides,
});

export const renderSetup = () => {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DocsSetupModal onClose={onClose} />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  const dialog = screen.getByRole('dialog', { name: 'Set up your docs' });
  return { ...view, user, dialog, onClose };
};

export type Setup = ReturnType<typeof renderSetup>;

export const stepHeading = (dialog: HTMLElement, name: string) => within(dialog).getByRole('heading', { name });

export const nameThenContinue = async ({ user, dialog }: Pick<Setup, 'user' | 'dialog'>, name = 'Acme Docs') => {
  await user.type(within(dialog).getByLabelText('Name'), name);
  await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
};
