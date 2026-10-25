import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { installFakeFetch } from './fixtures/fake-fetch';
import {
  SETUP_SITES,
  createdDocs,
  nameThenContinue,
  notPointingHere,
  ownAddressRoutes,
  type Setup,
  renderSetup,
  resetSetupState,
  setupAccess,
  setupSpies,
  stepHeading,
} from './fixtures/docs-setup-harness';

// These tests click and type through whole flows. Alone they take 1 to 4 seconds; on a busy machine the 5 second default is too tight.
vi.setConfig({ testTimeout: 30_000 });

const { setLocation, setActiveSiteId, toast } = setupSpies;
const access = setupAccess;

vi.mock('wouter', () => ({ useLocation: () => ['/admin/docs', setLocation] }));

vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({
    sites: SETUP_SITES,
    activeSiteId: 'site-a',
    activeSite: SETUP_SITES[0],
    isLoading: false,
    error: null,
    setActiveSiteId,
    formatSiteLabel: (site: { name: string }) => site.name,
  }),
}));

vi.mock('@/hooks/use-site-access', () => ({
  useSiteAccess: () => ({ access: null, isLoading: false, isMainSiteAdmin: access.mainSiteAdmin, can: () => true }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

vi.mock('@/components/media/MediaPickerDialog', () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (item: { url: string }) => void }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ url: '/uploads/logo.png' })}>
        Use the test logo
      </button>
    ) : null,
}));

describe('Set up your docs: on their own address', () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    resetSetupState();
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('on their own address', () => {
    const chooseOwnAddress = async ({ user, dialog }: Pick<Setup, 'user' | 'dialog'>) => {
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('radio', { name: 'On their own address' }));
    };

    it('shows whether the address points here and whether its certificate is ready, as soon as it is picked', async () => {
      const { callsTo } = installFakeFetch(ownAddressRoutes());
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });

      expect(await within(dialog).findByText("docs.acme.com doesn't point here yet")).toBeInTheDocument();
      expect(within(dialog).getByText('Certificate')).toBeInTheDocument();
      expect(within(dialog).getByText('Set up by itself once the address points here.')).toBeInTheDocument();
      const detail = within(dialog).getByText(/At your domain provider, add an A record named/);
      expect(detail).toHaveTextContent('At your domain provider, add an A record named docs with the value 203.0.113.10.');
      expect(within(dialog).getByText('You can finish now. Until the address is ready, the docs open from the admin preview.')).toBeInTheDocument();
      expect(within(dialog).getByText('.acme.com')).toBeInTheDocument();
      expect(callsTo({ method: 'GET', prefix: '/api/setup/verify-domain' })).toHaveLength(1);
    });

    it('checks again when the box is left, with the new address', async () => {
      const { callsTo } = installFakeFetch(
        ownAddressRoutes({
          'GET /api/setup/verify-domain?q=help2.acme.com': {
            json: {
              status: true,
              data: {
                normalizedInput: 'help2.acme.com',
                checkedHostnames: ['help2.acme.com'],
                dns: { 'help2.acme.com': { ok: true, addresses: ['203.0.113.10'] } },
                ipMatch: { ok: true, skipped: false, expectedIp: '203.0.113.10', message: 'ok' },
                caddy: { ok: true, message: 'ok' },
              },
            },
          },
        }),
      );
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      await within(dialog).findByText("docs.acme.com doesn't point here yet");

      const address = within(dialog).getByLabelText('Address');
      await user.clear(address);
      await user.type(address, 'help2');
      expect(within(dialog).queryByText("docs.acme.com doesn't point here yet")).not.toBeInTheDocument();
      await user.tab();

      expect(await within(dialog).findByText('help2.acme.com points here')).toBeInTheDocument();
      expect(within(dialog).getByText('Certificate is ready')).toBeInTheDocument();
      expect(callsTo({ method: 'GET', prefix: '/api/setup/verify-domain' }).map((call) => call.url)).toEqual([
        '/api/setup/verify-domain?q=docs.acme.com',
        '/api/setup/verify-domain?q=help2.acme.com',
      ]);
    });

    it('says plainly when the check could not run, and can be asked again', async () => {
      let asked = 0;
      installFakeFetch(
        ownAddressRoutes({
          'GET /api/setup/verify-domain?q=docs.acme.com': () => (++asked === 1 ? { status: 400, json: { status: false, message: 'Verification failed' } } : { json: notPointingHere }),
        }),
      );
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });

      expect(await within(dialog).findByText(/We couldn't check this address right now\. Verification failed/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Check again' }));
      expect(await within(dialog).findByText("docs.acme.com doesn't point here yet")).toBeInTheDocument();
    });

    it('is not offered to people who cannot add a site, and says why', async () => {
      access.mainSiteAdmin = false;
      installFakeFetch({});
      const { dialog, user } = renderSetup();
      await nameThenContinue({ user, dialog });

      const own = within(dialog).getByRole('radio', { name: 'On their own address' });
      expect(own).toBeDisabled();
      expect(within(dialog).getByText("Only the main site's admins can add a new address.")).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: 'On this site' })).toBeChecked();
    });

    it('refuses an address another site already uses, before anything is made', async () => {
      const { callsTo } = installFakeFetch(ownAddressRoutes({ 'GET /api/setup/verify-domain?q=help.acme.com': { json: notPointingHere } }));
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      const address = within(dialog).getByLabelText('Address');
      await user.clear(address);
      await user.type(address, 'help');
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      expect(within(dialog).getByText('Help center already uses this address.')).toBeInTheDocument();
      expect(stepHeading(dialog, 'Where do your docs live?')).toBeInTheDocument();
      expect(callsTo({ method: 'POST', prefix: '/api/sites' })).toHaveLength(0);
    });

    it('makes the site, the docs on it and its homepage, then connects the address and switches to the docs site', async () => {
      const { callsTo, calls } = installFakeFetch(ownAddressRoutes());
      const { user, dialog, onClose } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      await within(dialog).findByText("docs.acme.com doesn't point here yet");
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/home-9'));

      const writes = calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.url}`);
      expect(writes).toEqual(['POST /api/sites', 'POST /api/docs', 'POST /api/options?siteId=site-new', 'PATCH /api/sites/site-new']);
      expect(callsTo({ method: 'POST', prefix: '/api/sites' })[0]?.body).toEqual({ name: 'Acme Docs', siteUrl: null, description: null });
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })[0]?.body).toEqual({
        siteId: 'site-new',
        name: 'Acme Docs',
        slug: 'docs',
        search: true,
        features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
      });
      expect(callsTo({ method: 'POST', prefix: '/api/options' })[0]?.body).toEqual({ name: 'homepage_page_slug', value: 'docs' });
      expect(callsTo({ method: 'PATCH', prefix: '/api/sites/site-new' })[0]?.body).toEqual({ siteUrl: 'docs.acme.com' });
      expect(setActiveSiteId).toHaveBeenCalledWith('site-new');
      expect(onClose).toHaveBeenCalled();
      const [announcement] = toast.mock.calls[0] ?? [];
      expect(announcement.title).toBe('Your docs are ready');
      expect(announcement.description).toContain("docs.acme.com isn't connected yet.");
      expect(announcement.description).toContain('the docs open from the admin preview');
    });

    it('says the address is connected when it already points here', async () => {
      installFakeFetch(
        ownAddressRoutes({
          'PATCH /api/sites/site-new': { json: { site: { id: 'site-new', name: 'Acme Docs', siteUrl: 'https://docs.acme.com', isDefault: false }, notice: null } },
        }),
      );
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      await waitFor(() => expect(toast).toHaveBeenCalled());
      expect(toast).toHaveBeenCalledWith({ title: 'Your docs are ready', description: 'docs.acme.com is connected. You are now working on that site.' });
    });

    it('does not make a second site when the docs failed and "Try again" is pressed', async () => {
      let attempts = 0;
      const { callsTo } = installFakeFetch(
        ownAddressRoutes({
          'POST /api/docs': () => (++attempts === 1 ? { status: 500, json: { message: "Couldn't finish that. Please try again." } } : createdDocs('site-new')),
        }),
      );
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      expect(
        await within(dialog).findByText("The new site was made, but your docs couldn't be set up in it. Couldn't finish that. Please try again."),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/home-9'));
      expect(callsTo({ method: 'POST', prefix: '/api/sites' })).toHaveLength(1);
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })).toHaveLength(2);
    });

    it('sends people back to the address with the server\'s reason when the site cannot be made', async () => {
      installFakeFetch(ownAddressRoutes({ 'POST /api/sites': { status: 403, json: { message: "Only the main site's admins can add sites." } } }));
      const { user, dialog } = renderSetup();
      await chooseOwnAddress({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      expect(await within(dialog).findByText("Only the main site's admins can add sites.")).toBeInTheDocument();
      expect(stepHeading(dialog, 'Where do your docs live?')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Address')).toBeInvalid();
      expect(setLocation).not.toHaveBeenCalled();
    });
  });
});
