import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreUpdateManageStatus, CoreUpdateRun } from '@shared/core-update';
import { CoreUpdateDialog } from '@/components/core-update';

const apiRequest = vi.fn();
const followCoreUpdate = vi.fn();

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

vi.mock('@/components/core-update/follow-core-update', () => ({
  followCoreUpdate: (...args: unknown[]) => followCoreUpdate(...args),
}));

const run = (overrides: Partial<CoreUpdateRun> = {}): CoreUpdateRun => ({
  requestId: 'req-1',
  state: 'requested',
  step: 'waiting',
  version: '1.4.3',
  fromVersion: null,
  code: 'requested',
  message: 'Waiting for the server to start the update.',
  startedAt: '2026-10-10T12:00:00Z',
  finishedAt: null,
  logPath: null,
  failedWhileInstalling: false,
  slow: false,
  ...overrides,
});

const status = (overrides: Partial<CoreUpdateManageStatus> = {}): CoreUpdateManageStatus => ({
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

const renderDialog = (current: CoreUpdateManageStatus, onOpenChange = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CoreUpdateDialog open={true} onOpenChange={onOpenChange} status={current} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
};

const apiError = (message: string, code: string, httpStatus: number): Error =>
  Object.assign(new Error(message), { code, status: httpStatus });

describe('CoreUpdateDialog', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    followCoreUpdate.mockReset();
    followCoreUpdate.mockImplementation(() => new Promise(() => undefined));
    window.localStorage.clear();
  });

  it('reviews what will happen, then asks for the password before anything starts', async () => {
    const user = userEvent.setup();
    renderDialog(status());

    expect(screen.getByRole('heading', { name: /Update NextPress/ })).toBeInTheDocument();
    expect(screen.getByText('1.4.2')).toBeInTheDocument();
    expect(screen.getByText('1.4.3')).toBeInTheDocument();
    expect(screen.getByText(/offline for about 2 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Release notes/ })).toHaveAttribute('href', expect.stringContaining('v1.4.3'));

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const update = screen.getByRole('button', { name: 'Update now' });
    expect(update).toBeDisabled();
    expect(screen.getByText('Enter your password to continue.')).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('starts with the password and the reviewed version, then follows the update without a way to close', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue({ json: async () => ({ started: true, status: status({ run: run() }) }) });
    const { onOpenChange } = renderDialog(status());

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Update now' }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('POST', '/api/system/update/start', { password: 'correct horse', expectedVersion: '1.4.3' }),
    );
    expect(await screen.findByRole('heading', { name: /Updating NextPress/ })).toBeInTheDocument();
    expect(screen.getByText('Getting ready')).toBeInTheDocument();
    expect(screen.getByText('This page reloads by itself when the update is done.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(followCoreUpdate).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1' }));
    expect(JSON.parse(window.localStorage.getItem('np:core-update:pending') ?? '{}')).toEqual({
      requestId: 'req-1',
      fromVersion: '1.4.2',
      toVersion: '1.4.3',
    });

    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps the person on the password step with the reason when the password is wrong', async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(apiError("That password isn't right. Try again.", 'wrong_password', 403));
    renderDialog(status());

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'guess');
    await user.click(screen.getByRole('button', { name: 'Update now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("That password isn't right. Try again.");
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(followCoreUpdate).not.toHaveBeenCalled();
  });

  it('goes back to the review when a newer version came out in the meantime', async () => {
    const user = userEvent.setup();
    apiRequest.mockRejectedValue(apiError('NextPress 1.4.4 came out in the meantime. Review it, then start the update again.', 'version_changed', 409));
    renderDialog(status());

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Update now' }));

    expect(await screen.findByText(/1.4.4 came out in the meantime/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it("explains why this server can't update itself and gives the one command instead", () => {
    renderDialog(
      status({
        availability: { ready: false, blocker: 'no_helper', message: "This server can't update itself from here yet." },
      }),
    );
    expect(screen.getByText("This server can't update itself from here yet.")).toBeInTheDocument();
    expect(screen.getByText('sudo nextpress upgrade --version beta-v1.4.3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('opens on what happened when the last update did not finish', () => {
    renderDialog(
      status({
        run: run({
          state: 'failed',
          step: null,
          code: 'low_disk',
          message: 'The server is running out of disk space. Free up some space on the server, then try again.',
          logPath: '/opt/nextpress/update-logs/update-20261010-120000.log',
          failedWhileInstalling: true,
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: /The update didn't finish/ })).toBeInTheDocument();
    expect(screen.getByText(/running out of disk space/)).toBeInTheDocument();
    expect(screen.getByText('Your sites are running NextPress 1.4.2.')).toBeInTheDocument();
    expect(screen.getByText(/a copy was saved on the server/)).toBeInTheDocument();
    expect(screen.getByText('/opt/nextpress/update-logs/update-20261010-120000.log')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('resumes following an update that is already under way', () => {
    renderDialog(status({ run: run({ state: 'running', step: 'download', code: 'running' }) }));
    expect(screen.getByRole('heading', { name: /Updating NextPress/ })).toBeInTheDocument();
    expect(screen.getByText('Your sites stay online.')).toBeInTheDocument();
    expect(followCoreUpdate).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1' }));
  });
});
