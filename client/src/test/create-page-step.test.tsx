import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CreatePageModal } from '@/components/Pages/CreatePageModal';
import { mergePageOtherWithDefaults } from '@shared/page-other';
import { installFakeFetch } from './fixtures/fake-fetch';

// These tests click and type through whole flows. Alone they take 1 to 4 seconds; on a busy machine the 5 second default is too tight.
vi.setConfig({ testTimeout: 30_000 });

const setLocation = vi.fn();
vi.mock('wouter', () => ({ useLocation: () => ['/admin/pages', setLocation] }));

vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({ activeSiteId: 'site-a', activeSite: undefined, sites: [], isLoading: false, error: null }),
}));

const lists = { templates: [] as { id: string; name: string; blocks: unknown[] }[] };
vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], posts: [], themes: [], templates: lists.templates, isLoading: false }),
}));

const assistant = { enabled: false };
vi.mock('@/hooks/use-ai-settings', () => ({ useAiStatus: () => ({ data: { enabled: assistant.enabled } }) }));

const setPendingDescription = vi.fn();
vi.mock('@/components/PageBuilder/assistant/assistant-storage', () => ({
  setPendingDescription: (input: { pageId: string; description: string }) => setPendingDescription(input),
}));

const showSuccessToast = vi.fn();
vi.mock('@/lib/sonner-toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sonner-toast')>()),
  showSuccessToast: (message: string) => showSuccessToast(message),
}));

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Pricing',
  blocks: [{ id: 'old-block', name: 'core/heading', type: 'text', parentId: null, content: { kind: 'text', value: 'Pricing' }, children: [] }],
};

const renderStep = (props: { initialTitle?: string } = {}) => {
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CreatePageModal open onOpenChange={onOpenChange} {...props} />
    </QueryClientProvider>,
  );
  return { ...view, onOpenChange, user: userEvent.setup(), dialog: screen.getByRole('dialog', { name: 'New page' }) };
};

describe('New page step', () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    setLocation.mockClear();
    setPendingDescription.mockClear();
    showSuccessToast.mockClear();
    lists.templates = [];
    assistant.enabled = false;
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
    vi.unstubAllGlobals();
  });

  it('asks only for a title and what to start from', () => {
    installFakeFetch({});
    const { dialog } = renderStep();

    expect(within(dialog).getByLabelText('Title')).toBeInTheDocument();
    expect(within(dialog).getByText('Start from')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/describe your page/i)).not.toBeInTheDocument();
    for (const gone of [/slug/i, /featured image/i, /allow comments/i, /password/i, /parent/i, /menu order/i]) {
      expect(within(dialog).queryByLabelText(gone)).not.toBeInTheDocument();
      expect(within(dialog).queryByText(gone)).not.toBeInTheDocument();
    }
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1);
  });

  it('keeps "Describe your page" for the assistant, when the assistant is on', () => {
    assistant.enabled = true;
    installFakeFetch({});
    const { dialog } = renderStep();

    expect(within(dialog).getByLabelText('Describe your page (optional)')).toBeInTheDocument();
    expect(within(dialog).getByText('The assistant builds a first draft when the editor opens. Nothing is published.')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(2);
  });

  it('says where the address comes from, and that Page settings can change it', async () => {
    installFakeFetch({});
    const { user, dialog } = renderStep();

    expect(within(dialog).getByText(/Its address comes from the title\./)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Title'), 'About Us!');
    expect(within(dialog).getByText('Its address will be /about-us. You can change it later in Page settings.')).toBeInTheDocument();
  });

  it('creates the page with the existing call and opens the editor on it', async () => {
    const { callsTo } = installFakeFetch({ 'POST /api/pages': { status: 201, json: { id: 'page-7', title: 'About Us' } } });
    const { user, dialog, onOpenChange } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'About Us');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(setLocation).toHaveBeenCalledWith('/admin/page-builder/page/page-7?mode=builder'));
    expect(callsTo({ method: 'POST', prefix: '/api/pages' })).toHaveLength(1);
    expect(callsTo({ method: 'POST', prefix: '/api/pages' })[0]?.body).toEqual({
      title: 'About Us',
      slug: 'about-us',
      status: 'draft',
      siteId: 'site-a',
      blocks: [],
      other: mergePageOtherWithDefaults(),
      allowComments: true,
      menuOrder: 0,
    });
    expect(showSuccessToast).toHaveBeenCalledWith('Page created successfully');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('creates on Enter in the title box', async () => {
    const { callsTo } = installFakeFetch({ 'POST /api/pages': { status: 201, json: { id: 'page-8' } } });
    const { user, dialog } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'Pricing{Enter}');

    await waitFor(() => expect(callsTo({ method: 'POST', prefix: '/api/pages' })).toHaveLength(1));
  });

  it('asks for a title next to the box when it is empty, and sends nothing', async () => {
    const { callsTo } = installFakeFetch({});
    const { user, dialog } = renderStep();

    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    expect(within(dialog).getByText('Give the page a title.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title')).toBeInvalid();
    expect(callsTo({ method: 'POST', prefix: '/api/pages' })).toHaveLength(0);
  });

  it('starts from a template: a select with Blank first, and the template blocks copied under new ids', async () => {
    lists.templates = [TEMPLATE];
    const { callsTo } = installFakeFetch({ 'POST /api/pages': { status: 201, json: { id: 'page-9' } } });
    const { user, dialog } = renderStep();

    const startFrom = within(dialog).getByLabelText('Start from');
    expect(within(startFrom).getAllByRole('option').map((option) => option.textContent)).toEqual(['Blank', 'Pricing']);
    expect(startFrom).toHaveValue('');

    await user.type(within(dialog).getByLabelText('Title'), 'Pricing');
    await user.selectOptions(startFrom, 'tpl-1');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(setLocation).toHaveBeenCalled());
    const body = callsTo({ method: 'POST', prefix: '/api/pages' })[0]?.body as { templateId?: string; blocks?: { id: string; name: string }[] };
    expect(body.templateId).toBe('tpl-1');
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks?.[0]?.name).toBe('core/heading');
    expect(body.blocks?.[0]?.id).not.toBe('old-block');
  });

  it('says so when there are no templates, instead of an empty choice', () => {
    installFakeFetch({});
    const { dialog } = renderStep();

    expect(within(dialog).getByText('No templates yet. The page will start blank.')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Start from')).not.toBeInTheDocument();
  });

  it('hands the description to the editor for the assistant, only when the assistant is on', async () => {
    assistant.enabled = true;
    installFakeFetch({ 'POST /api/pages': { status: 201, json: { id: 'page-7' } } });
    const { user, dialog } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'Yoga');
    await user.type(within(dialog).getByLabelText('Describe your page (optional)'), 'A landing page for a yoga studio');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(setPendingDescription).toHaveBeenCalledWith({ pageId: 'page-7', description: 'A landing page for a yoga studio' }));
  });

  it('does not keep a description when the assistant is off', async () => {
    installFakeFetch({ 'POST /api/pages': { status: 201, json: { id: 'page-7' } } });
    const { user, dialog } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'Yoga');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    await waitFor(() => expect(setLocation).toHaveBeenCalled());
    expect(setPendingDescription).not.toHaveBeenCalled();
  });

  it('starts with the title from a link like /admin/pages?create=true&title=Contact', () => {
    installFakeFetch({});
    const { dialog } = renderStep({ initialTitle: 'Contact' });

    expect(within(dialog).getByLabelText('Title')).toHaveValue('Contact');
    expect(within(dialog).getByText(/Its address will be \/contact\./)).toBeInTheDocument();
  });

  it('tells people to change the title when a page already has that address, next to the title', async () => {
    installFakeFetch({ 'POST /api/pages': { status: 409, json: { message: 'This page already exists. Choose a different URL slug.', code: 'PAGE_SLUG_EXISTS' } } });
    const { user, dialog, onOpenChange } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'About');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    expect(await within(dialog).findByText('A page with this title already exists. Try a slightly different title.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title')).toBeInvalid();
    expect(setLocation).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ atFunction: 'CreatePageModal.createPage', data: expect.objectContaining({ siteId: 'site-a', title: 'About' }) }),
    );

    await user.type(within(dialog).getByLabelText('Title'), ' Us');
    expect(within(dialog).queryByText(/already exists/)).not.toBeInTheDocument();
  });

  it('shows any other failure in plain words under the form, and stays open', async () => {
    installFakeFetch({ 'POST /api/pages': { status: 500, json: { message: 'Failed to create page. Please try again.' } } });
    const { user, dialog } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'About');
    await user.click(within(dialog).getByRole('button', { name: 'Create page' }));

    expect(await within(dialog).findByText('Failed to create page. Please try again.')).toBeInTheDocument();
    expect(setLocation).not.toHaveBeenCalled();
  });

  it('closes with Cancel and forgets the title', async () => {
    installFakeFetch({});
    const { user, dialog, onOpenChange } = renderStep();

    await user.type(within(dialog).getByLabelText('Title'), 'Draft idea');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(within(dialog).getByLabelText('Title')).toHaveValue('');
  });
});
