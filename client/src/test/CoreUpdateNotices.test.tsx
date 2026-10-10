import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreUpdateStatus } from '@shared/core-update';
import { getQueryFn } from '@/lib/queryClient';
import { WhatsNewSidebarBanner } from '@/components/admin/WhatsNewSidebarBanner';
import { CoreUpdateDashboardNotice } from '@/components/core-update';

const showSuccessToast = vi.fn();
vi.mock('@/lib/sonner-toast', () => ({
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
  showErrorToast: vi.fn(),
}));

const release = {
  installedVersion: '1.4.2',
  latestVersion: '1.4.3',
  updateAvailable: true,
  releaseDate: '2026-10-03',
  highlights: [{ kind: 'update', title: 'Forms', description: 'Add a Form block to any page.' }],
  supportedUpgradeFrom: [],
};

const adminStatus = (overrides: Record<string, string | boolean | null> = {}): CoreUpdateStatus => ({
  canManage: true,
  installedVersion: '1.4.2',
  latestVersion: '1.4.3',
  updateAvailable: true,
  checkOk: true,
  checkedAt: '2026-10-10T12:00:00Z',
  releaseNotesUrl: 'https://github.com/nextpress-ai/nextpress/releases/tag/v1.4.3',
  availability: { ready: true },
  manualCommand: 'sudo nextpress upgrade --version beta-v1.4.3',
  downtime: 'about 2 minutes',
  run: null,
  ...overrides,
});

const serve = (updateStatus: CoreUpdateStatus) => {
  global.fetch = vi.fn(async (url: string | URL | Request) => {
    const path = String(url);
    const body = path.includes('/api/system/update/status') ? updateStatus : path.includes('/api/system/release') ? release : {};
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
};

const renderWithQueries = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: 'throw' }) } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('sidebar update notice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    showSuccessToast.mockReset();
  });

  it('tells main-site admins about a newer release and opens the update dialog', async () => {
    const user = userEvent.setup();
    serve(adminStatus());
    renderWithQueries(<WhatsNewSidebarBanner />);

    const banner = await screen.findByRole('button', { name: /Update available · v1.4.3/ });
    expect(banner).toHaveTextContent('Installed v1.4.2');
    await user.click(banner);
    expect(await screen.findByRole('heading', { name: /Update NextPress/ })).toBeInTheDocument();
  });

  it("shows everyone else What's New, never the update", async () => {
    serve({ canManage: false });
    renderWithQueries(<WhatsNewSidebarBanner />);
    expect(await screen.findByRole('button', { name: /What's new/ })).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/system/update/status', expect.anything()));
    expect(screen.queryByText(/Update available/)).not.toBeInTheDocument();
  });

  it("opens What's New by itself after the update this browser started has finished", async () => {
    window.localStorage.setItem('np:core-update:pending', JSON.stringify({ requestId: 'req-1', fromVersion: '1.4.1', toVersion: '1.4.2' }));
    serve(adminStatus({ latestVersion: '1.4.2', updateAvailable: false }));
    renderWithQueries(<WhatsNewSidebarBanner />);

    expect(await screen.findByRole('heading', { name: /What's new in v1.4.2/ })).toBeInTheDocument();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(showSuccessToast).toHaveBeenCalledWith('NextPress is now on 1.4.2.');
    expect(window.localStorage.getItem('np:core-update:pending')).toBeNull();
  });
});

describe('dashboard update notice', () => {
  it('shows a quiet card with the one action for main-site admins', async () => {
    serve(adminStatus());
    renderWithQueries(<CoreUpdateDashboardNotice />);
    expect(await screen.findByText('NextPress 1.4.3 is available')).toBeInTheDocument();
    expect(screen.getByText("You're on 1.4.2. Updating takes your sites offline for about 2 minutes.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update now' })).toBeInTheDocument();
  });

  it('renders nothing for people who cannot update, or when there is nothing new', async () => {
    serve({ canManage: false });
    const { container } = renderWithQueries(<CoreUpdateDashboardNotice />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
