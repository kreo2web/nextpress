import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { installFakeFetch, type FakeRoutes } from './fixtures/fake-fetch';
import {
  SETUP_SITES,
  createdDocs,
  nameThenContinue,
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

const sameSiteRoutes: FakeRoutes = { 'POST /api/docs': createdDocs('site-a') };

describe('Set up your docs', () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    resetSetupState();
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('the steps and their checks', () => {
    it('starts on step 1 with a live preview beside it', () => {
      installFakeFetch({});
      const { dialog } = renderSetup();

      expect(stepHeading(dialog, 'What are your docs called?')).toBeInTheDocument();
      expect(within(dialog).getByText('Step 1 of 3')).toBeInTheDocument();
      expect(within(dialog).getByRole('img', { name: /^Preview of Your docs at acme\.com\/docs/ })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('needs a name before it goes on, and says so next to the box', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();

      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      expect(within(dialog).getByText('Give your docs a name.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name')).toBeInvalid();
      expect(stepHeading(dialog, 'What are your docs called?')).toBeInTheDocument();

      await user.type(within(dialog).getByLabelText('Name'), 'A');
      expect(within(dialog).queryByText('Give your docs a name.')).not.toBeInTheDocument();
    });

    it('shows the name in the preview as it is typed', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();

      await user.type(within(dialog).getByLabelText('Name'), 'Acme Docs');

      expect(within(dialog).getByRole('img', { name: /^Preview of Acme Docs at acme\.com\/docs/ })).toBeInTheDocument();
    });

    it('takes a logo from the media picker, shows it, and lets it go again', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();

      await user.click(within(dialog).getByRole('button', { name: 'Choose logo' }));
      await user.click(screen.getByRole('button', { name: 'Use the test logo' }));

      expect(within(dialog).getByAltText('Your logo')).toHaveAttribute('src', '/uploads/logo.png');
      await user.click(within(dialog).getByRole('button', { name: 'Remove logo' }));
      expect(within(dialog).queryByAltText('Your logo')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Choose logo' })).toBeInTheDocument();
    });

    it('step 2 only accepts letters, numbers and dashes for the address part, and says what is wrong next to it', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });

      expect(stepHeading(dialog, 'Where do your docs live?')).toBeInTheDocument();
      const address = within(dialog).getByLabelText('Address');
      expect(address).toHaveValue('docs');
      expect(within(dialog).getByText('acme.com/')).toBeInTheDocument();

      await user.clear(address);
      await user.type(address, 'my docs');
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      expect(within(dialog).getByText("Use letters, numbers and dashes only, and don't start or end with a dash.")).toBeInTheDocument();
      expect(address).toBeInvalid();
      expect(stepHeading(dialog, 'Where do your docs live?')).toBeInTheDocument();

      await user.clear(address);
      await user.type(address, 'admin');
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      expect(within(dialog).getByText('"admin" is used by NextPress itself. Try docs or help.')).toBeInTheDocument();

      await user.clear(address);
      await user.type(address, 'help-center');
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      expect(stepHeading(dialog, 'What do your docs have?')).toBeInTheDocument();
    });

    it('step 3 starts with every switch on', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      for (const label of ['Search', 'Sidebar', 'On this page', 'Previous / next', 'Copy page']) {
        expect(within(dialog).getByRole('switch', { name: label })).toBeChecked();
      }
      expect(within(dialog).getByRole('button', { name: 'Create docs' })).toBeInTheDocument();
    });

    it('draws the preview from the switches', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      await user.click(within(dialog).getByRole('switch', { name: 'Sidebar' }));
      await user.click(within(dialog).getByRole('switch', { name: 'Copy page' }));

      const label = within(dialog).getByRole('img', { name: /^Preview of Acme Docs/ }).getAttribute('aria-label');
      expect(label).toContain('search');
      expect(label).toContain('an On this page list');
      expect(label).not.toContain('a sidebar');
      expect(label).not.toContain('Copy page');
    });

    it('goes back with Back and keeps what was typed, and a finished step in the rail says what was chosen', async () => {
      installFakeFetch({});
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });

      const rail = within(dialog).getByRole('navigation', { name: 'Steps' });
      expect(within(rail).getByRole('button', { name: /Name\s*Acme Docs/ })).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Back' }));
      expect(stepHeading(dialog, 'What are your docs called?')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Acme Docs');
    });
  });

  describe('finishing on this site', () => {
    it('sends the name, address part, logo, search and features exactly as chosen, then opens the editor on the docs home', async () => {
      const { callsTo } = installFakeFetch({ 'POST /api/docs': createdDocs('site-a', '/help') });
      const { user, dialog, onClose } = renderSetup();

      await user.type(within(dialog).getByLabelText('Name'), 'Acme Docs');
      await user.click(within(dialog).getByRole('button', { name: 'Choose logo' }));
      await user.click(screen.getByRole('button', { name: 'Use the test logo' }));
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      const address = within(dialog).getByLabelText('Address');
      await user.clear(address);
      await user.type(address, 'Help');
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

      await user.click(within(dialog).getByRole('switch', { name: 'Search' }));
      await user.click(within(dialog).getByRole('switch', { name: 'On this page' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/home-9'));
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })).toHaveLength(1);
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })[0]?.body).toEqual({
        siteId: 'site-a',
        name: 'Acme Docs',
        slug: 'help',
        logoUrl: '/uploads/logo.png',
        search: false,
        features: { sidebar: true, toc: false, prevNext: true, copyPage: true },
      });
      expect(callsTo({ method: 'POST', prefix: '/api/sites' })).toHaveLength(0);
      expect(setActiveSiteId).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith({ title: 'Your docs are ready', description: null });
    });

    it('with the defaults, sends docs as the address and everything on', async () => {
      const { callsTo } = installFakeFetch(sameSiteRoutes);
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      await waitFor(() => expect(setLocation).toHaveBeenCalled());
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })[0]?.body).toEqual({
        siteId: 'site-a',
        name: 'Acme Docs',
        slug: 'docs',
        search: true,
        features: { sidebar: true, toc: true, prevNext: true, copyPage: true },
      });
    });

    it('tells people where the docs really are when the server had to pick another address part', async () => {
      installFakeFetch({ 'POST /api/docs': createdDocs('site-a', '/docs-2') });
      const { user, dialog } = renderSetup();
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/home-9'));
      expect(toast).toHaveBeenCalledWith({ title: 'Your docs are ready', description: 'They are at /docs-2 because /docs was taken.' });
    });

    it('keeps the setup open on a failure, says it in plain words on the step, and tries again from there', async () => {
      let attempts = 0;
      const { callsTo } = installFakeFetch({
        'POST /api/docs': () =>
          ++attempts === 1 ? { status: 429, json: { message: 'Too many changes at once. Wait a minute and try again.' } } : createdDocs('site-a'),
      });
      const { user, dialog, onClose } = renderSetup();
      await nameThenContinue({ user, dialog });
      await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
      await user.click(within(dialog).getByRole('button', { name: 'Create docs' }));

      expect(await within(dialog).findByText('Too many changes at once. Wait a minute and try again.')).toBeInTheDocument();
      expect(within(dialog).getByText("We couldn't finish setting up your docs")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({ atFunction: 'docsSetup.createDocs', data: expect.objectContaining({ siteId: 'site-a' }) }),
      );

      await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/home-9'));
      expect(callsTo({ method: 'POST', prefix: '/api/docs' })).toHaveLength(2);
    });
  });
});
