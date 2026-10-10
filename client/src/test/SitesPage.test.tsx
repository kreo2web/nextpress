import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sites from '@/pages/Sites';
import { buildPublicContentUrl } from '@/lib/site-api';
import * as queryClientModule from '@/lib/queryClient';

vi.mock('@/components/AdminLayout', () => ({
  AdminLayout: ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => (
    <div>
      <div>{actions}</div>
      {children}
    </div>
  ),
}));

vi.mock('@/components/domain', () => ({
  DomainInputWithVerify: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) => (
    <label htmlFor={id}>
      {label}
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const setActiveSiteId = vi.fn();
const SITES = [
  { id: 'site-main', name: 'Main', siteUrl: 'https://example.com', isDefault: true },
  { id: 'site-shop', name: 'Shop', siteUrl: null, isDefault: false },
];
vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({
    sites: SITES,
    activeSiteId: 'site-main',
    activeSite: SITES[0],
    setActiveSiteId,
    formatSiteLabel: (site: { name: string }) => site.name,
  }),
}));

const apiRequest = vi.spyOn(queryClientModule, 'apiRequest');

const renderSites = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: async () => ({ sites: SITES, total: 2 }) } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Sites />
    </QueryClientProvider>,
  );
};

describe('Sites page', () => {
  beforeEach(() => {
    mockToast.mockClear();
    setActiveSiteId.mockClear();
    apiRequest.mockReset();
  });

  it('creates a site without jumping to it, and offers "Switch to it"', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue(
      new Response(JSON.stringify({ site: { id: 'site-new', name: 'Blog', siteUrl: null, isDefault: false }, notice: null })),
    );
    renderSites();

    await user.click(screen.getByRole('button', { name: /add site/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Enter a name' })).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/name/i), 'Blog');
    await user.type(within(dialog).getByLabelText('Address'), 'blog.example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Create site' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('POST', '/api/sites', {
      name: 'Blog',
      siteUrl: 'blog.example.com',
      description: null,
    }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Site created' })));
    expect(setActiveSiteId).not.toHaveBeenCalled();
    expect(mockToast.mock.calls[0]?.[0]).toHaveProperty('action');
  });

  it('shows the server\'s plain reason when an address is refused', async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(new Error('Main already uses this address.'));
    renderSites();

    await user.click(screen.getByRole('button', { name: /add site/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/name/i), 'Copy');
    await user.type(within(dialog).getByLabelText('Address'), 'www.example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Create site' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Main already uses this address.', variant: 'destructive' }),
      ),
    );
  });

  it('lists each site with its address, or says it has none', async () => {
    renderSites();
    expect(await screen.findByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByText('No address yet')).toBeInTheDocument();
  });
});

describe('buildPublicContentUrl', () => {
  const main = { id: 'site-main', siteUrl: 'https://example.com/', isDefault: true };
  const shop = { id: 'site-shop', siteUrl: null, isDefault: false };

  it('links to the page on its own site address', () => {
    expect(buildPublicContentUrl({ site: main, slug: 'contact', kind: 'page' })).toBe('https://example.com/contact');
    expect(buildPublicContentUrl({ site: main, slug: 'hello', kind: 'post' })).toBe('https://example.com/post/hello');
  });

  it('uses the site path for a site with no address, and has no public post link there', () => {
    expect(buildPublicContentUrl({ site: shop, slug: 'contact', kind: 'page' })).toBe('/sites/site-shop/contact');
    expect(buildPublicContentUrl({ site: shop, slug: 'hello', kind: 'post' })).toBeNull();
  });

  it('stays relative for a default site with no address', () => {
    expect(buildPublicContentUrl({ site: { ...main, siteUrl: null }, slug: 'contact', kind: 'page' })).toBe('/contact');
  });
});
