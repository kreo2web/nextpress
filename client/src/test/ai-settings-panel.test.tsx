import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSaveError, AiSettingsView } from '@shared/ai-builder';
import { AiSettingsPanel } from '@/components/settings/ai-settings';
import { looksLocalAddress } from '@/components/settings/ai-settings/ai-settings-rules';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

const SITE_ID = '3f2b8a40-6c1d-4a57-9e0b-5d7c1a2b9e11';

vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({ activeSiteId: SITE_ID }),
}));

type Call = {
  method: string;
  path: string;
  siteId: string | null;
  body: Record<string, string> | null;
};

type ServerSetup = {
  canManage?: boolean;
  isEnabled?: boolean;
  saved?: AiSettingsView | null;
  /** Makes every save fail with this body. */
  saveFails?: { status: number; body: AiSaveError | { message: string } };
  /** A save waits for this before the server answers, so the "saving" moment can be looked at. */
  holdSave?: Promise<void>;
};

const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const makeView = (overrides: Partial<AiSettingsView> = {}): AiSettingsView => ({
  configured: true,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  baseUrl: null,
  hasKey: true,
  keyEnding: 'abcd',
  keyUnreadable: false,
  updatedAt: '2026-10-15T09:30:00.000Z',
  ...overrides,
});

/** The server's three answers, as far as this screen can tell: what is saved changes when a save or remove goes through. */
const installServer = ({ canManage = true, isEnabled = false, saved = null, saveFails, holdSave }: ServerSetup = {}) => {
  const state = { saved };
  const calls: Call[] = [];

  const answer = async (url: string, init?: RequestInit): Promise<Response> => {
    const parsed = new URL(url, 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : null;
    calls.push({ method, path: parsed.pathname, siteId: parsed.searchParams.get('siteId'), body });

    if (parsed.pathname.endsWith('/status')) return json({ enabled: isEnabled || state.saved !== null, canManage });
    if (method === 'GET') return json(state.saved ?? { configured: false });
    if (method === 'PUT') {
      await holdSave;
      if (saveFails) return json(saveFails.body, saveFails.status);
      state.saved = makeView({
        provider: body?.provider as AiSettingsView['provider'],
        model: body?.model ?? '',
        baseUrl: body?.baseUrl ?? null,
        hasKey: Boolean(body?.apiKey) || (state.saved?.hasKey ?? false),
        keyEnding: body?.apiKey ? body.apiKey.slice(-4) : (state.saved?.keyEnding ?? null),
        updatedAt: '2026-10-17T10:00:00.000Z',
      });
      return json(state.saved);
    }
    state.saved = null;
    return json({ configured: false });
  };

  const fetchMock = vi.fn(answer);
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock, findCall: (method: string) => calls.find((call) => call.method === method) };
};

const renderPanel = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiSettingsPanel />
      <Toaster />
    </QueryClientProvider>,
  );
};

const dismissAllToasts = () => {
  const { result } = renderHook(() => useToast());
  act(() => result.current.dismiss());
};

beforeEach(() => dismissAllToasts());

afterEach(() => {
  vi.unstubAllGlobals();
  dismissAllToasts();
});

const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('AI settings: who sees what', () => {
  it('shows people who cannot manage a calm note and no form', async () => {
    const server = installServer({ canManage: false, isEnabled: true });
    renderPanel();

    expect(await screen.findByText('The page assistant is on for this site.')).toBeInTheDocument();
    expect(screen.getByText("Only this site's owner or admins can change which AI service it uses.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Model name')).not.toBeInTheDocument();
    expect(server.calls.filter((call) => call.path.endsWith('/settings'))).toHaveLength(0);
  });

  it('says the assistant is off when it is off', async () => {
    installServer({ canManage: false, isEnabled: false });
    renderPanel();

    expect(await screen.findByText('The page assistant is off for this site.')).toBeInTheDocument();
  });

  it('shows placeholders shaped like the form while the answer is on its way', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderPanel();

    expect(screen.getByRole('status', { name: 'Loading the AI settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('offers Try again when the status cannot be loaded', async () => {
    const fetchMock = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(json({ message: 'raw server words' }, 500))
      .mockResolvedValue(json({ enabled: false, canManage: false }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("The settings couldn't be loaded. Try again.")).toBeInTheDocument();
    expect(screen.queryByText('raw server words')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('The page assistant is off for this site.')).toBeInTheDocument();
  });
});

describe('AI settings: first setup', () => {
  it('saves a built-in provider with exactly siteId, provider, model and key', async () => {
    const server = installServer();
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText(/Pick the AI service this site's page assistant uses/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Model name'), 'claude-sonnet-5-5');
    await user.type(screen.getByLabelText('Key'), 'sk-ant-secret-1234');
    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      apiKey: 'sk-ant-secret-1234',
    });
    expect(await screen.findByText('AI settings saved')).toBeInTheDocument();
  });

  it('shows a spinner while saving and never sends a second save', async () => {
    let finishSave: () => void = () => undefined;
    const server = installServer({
      holdSave: new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    });
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText('Model name'), 'claude-sonnet-5-5');
    await user.type(screen.getByLabelText('Key'), 'sk-ant-abc');
    await user.click(saveButton());

    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    await user.type(screen.getByLabelText('Model name'), '{Enter}');
    expect(server.calls.filter((call) => call.method === 'PUT')).toHaveLength(1);

    finishSave();
    expect(await screen.findByText('AI settings saved')).toBeInTheDocument();
    expect(server.calls.filter((call) => call.method === 'PUT')).toHaveLength(1);
  });

  it.each([
    ['OpenAI', 'openai'],
    ['Google (Gemini)', 'google'],
  ])('sends no address for %s', async (label, id) => {
    const server = installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: label }));
    await user.type(screen.getByLabelText('Model name'), 'some-model');
    await user.type(screen.getByLabelText('Key'), 'the-key-9876');
    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: id,
      model: 'some-model',
      apiKey: 'the-key-9876',
    });
  });

  it('forgets the typed key once the save went through and shows only how it ends', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText('Model name'), 'claude-sonnet-5-5');
    await user.type(screen.getByLabelText('Key'), 'sk-ant-secret-1234');
    await user.click(saveButton());

    expect(await screen.findByText('Key saved, ends in …1234')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Starts with sk-ant-')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('sk-ant-secret-1234');
  });

  it('fills the model name from a suggestion', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'claude-haiku-5-5' }));

    expect(screen.getByLabelText('Model name')).toHaveValue('claude-haiku-5-5');
  });
});

describe('AI settings: any OpenAI-compatible service', () => {
  it('shows the address, fills it from a preset and marks local ones', async () => {
    const server = installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Any OpenAI-compatible service' }));
    const address = screen.getByLabelText('Address');
    expect(address).toHaveValue('');

    await user.click(screen.getByRole('button', { name: /OpenRouter/ }));
    expect(address).toHaveValue('https://openrouter.ai/api/v1');
    expect(screen.getByRole('button', { name: /OpenRouter/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Leave empty if your local service needs no key.')).not.toBeInTheDocument();

    const ollama = screen.getByRole('button', { name: /Ollama/ });
    expect(within(ollama).getByText('On this computer')).toBeInTheDocument();
    await user.click(ollama);
    expect(address).toHaveValue('http://localhost:11434/v1');
    expect(screen.getByText('Leave empty if your local service needs no key.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Model name'), 'llama3');
    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: 'openai-compatible',
      model: 'llama3',
      baseUrl: 'http://localhost:11434/v1',
    });
  });

  it('keeps the address when you leave the choice and come back', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Any OpenAI-compatible service' }));
    await user.type(screen.getByLabelText('Address'), 'https://llm.example.com/v1');
    await user.click(screen.getByRole('button', { name: 'OpenAI' }));
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Any OpenAI-compatible service' }));
    expect(screen.getByLabelText('Address')).toHaveValue('https://llm.example.com/v1');
  });
});

describe('AI settings: the form explains what is missing', () => {
  it('disables Save with a reason next to it until everything is filled in', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    await screen.findByLabelText('Model name');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Enter the model's name to save.")).toBeInTheDocument();
    expect(saveButton()).toHaveAccessibleDescription("Enter the model's name to save.");

    await user.type(screen.getByLabelText('Model name'), 'claude-sonnet-5-5');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Enter your key to save.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Key'), 'sk-ant-abc');
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByText('Enter your key to save.')).not.toBeInTheDocument();
  });

  it('asks for the address first when the generic choice is picked', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Any OpenAI-compatible service' }));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Enter the address to save.')).toBeInTheDocument();
  });

  it('lets the key box be shown and hidden without changing what was typed', async () => {
    installServer();
    const user = userEvent.setup();
    renderPanel();

    const key = await screen.findByLabelText('Key');
    expect(key).toHaveAttribute('type', 'password');
    expect(key).toHaveAttribute('autocomplete', 'off');
    await user.type(key, 'sk-ant-abc');

    await user.click(screen.getByRole('button', { name: 'Show key' }));
    expect(screen.getByLabelText('Key')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Key')).toHaveValue('sk-ant-abc');

    await user.click(screen.getByRole('button', { name: 'Hide key' }));
    expect(screen.getByLabelText('Key')).toHaveAttribute('type', 'password');
  });
});

describe('AI settings: a key is already saved', () => {
  it('shows how the key ends, keeps the box hidden until Replace, and sends no key when it is left alone', async () => {
    const server = installServer({ saved: makeView() });
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText('Key saved, ends in …abcd')).toBeInTheDocument();
    expect(screen.getByLabelText('Model name')).toHaveValue('claude-sonnet-5-5');
    expect(screen.queryByPlaceholderText('Starts with sk-ant-')).not.toBeInTheDocument();

    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
  });

  it('opens an empty key box on Replace, hides it on Cancel and sends the new key when one is typed', async () => {
    const server = installServer({ saved: makeView() });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    const key = screen.getByLabelText('Key');
    expect(key).toHaveValue('');
    expect(key).toHaveFocus();

    await user.type(key, 'half-typed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
    expect(screen.getByText('Key saved, ends in …abcd')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByLabelText('Key')).toHaveValue('');
    await user.type(screen.getByLabelText('Key'), 'brand-new-key-7777');
    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      apiKey: 'brand-new-key-7777',
    });
    expect(await screen.findByText('Key saved, ends in …7777')).toBeInTheDocument();
  });

  it('shows the key box when the provider changes and goes back to the saved key when it changes back', async () => {
    installServer({ saved: makeView() });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.click(screen.getByRole('button', { name: 'OpenAI' }));

    expect(screen.getByLabelText('Key')).toHaveValue('');
    expect(screen.getByPlaceholderText('Starts with sk-')).toBeInTheDocument();
    expect(screen.getByText('You changed the provider or address, so enter a key for it.')).toBeInTheDocument();
    expect(screen.queryByText('Key saved, ends in …abcd')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Anthropic (Claude)' }));
    expect(screen.getByText('Key saved, ends in …abcd')).toBeInTheDocument();
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
  });

  it('does not send a key typed for another provider once the saved one is picked again', async () => {
    const server = installServer({ saved: makeView() });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.click(screen.getByRole('button', { name: 'OpenAI' }));
    await user.type(screen.getByLabelText('Key'), 'openai-key-for-another-service');
    await user.click(screen.getByRole('button', { name: 'Anthropic (Claude)' }));
    await user.click(saveButton());

    await waitFor(() => expect(server.findCall('PUT')).toBeDefined());
    expect(server.findCall('PUT')?.body).toEqual({
      siteId: SITE_ID,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });
  });

  it('asks for a key again when the address of a saved generic service changes', async () => {
    installServer({
      saved: makeView({ provider: 'openai-compatible', model: 'gpt-x', baseUrl: 'https://llm.example.com/v1' }),
    });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), 'https://other.example.com/v1');

    expect(screen.getByLabelText('Key')).toBeInTheDocument();
    expect(screen.getByText('You changed the provider or address, so enter a key for it.')).toBeInTheDocument();
  });

  it('keeps the saved key when a pasted endpoint is tidied back to the service address', async () => {
    installServer({
      saved: makeView({
        provider: 'openai-compatible',
        model: 'gpt-x',
        baseUrl: 'https://llm.example.com/v1/chat/completions',
      }),
    });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), 'https://llm.example.com/v1');

    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
    expect(screen.getByText('Key saved, ends in …abcd')).toBeInTheDocument();
  });

  it('tells the person to enter the key again when the saved one cannot be read', async () => {
    installServer({ saved: makeView({ keyUnreadable: true, keyEnding: null }) });
    renderPanel();

    expect(await screen.findByText('The saved key can no longer be read. Enter it again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Key')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('Enter your key to save.')).toBeInTheDocument();
  });

  it('says no key is needed for a local service saved without one', async () => {
    installServer({
      saved: makeView({
        provider: 'openai-compatible',
        model: 'llama3',
        baseUrl: 'http://localhost:11434/v1',
        hasKey: false,
        keyEnding: null,
      }),
    });
    renderPanel();

    expect(await screen.findByText("No key saved. That's fine for a service on this computer.")).toBeInTheDocument();
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });
});

describe('AI settings: when the server refuses', () => {
  it('marks the address, shows the reason under it and moves focus there', async () => {
    const message = 'We couldn\'t find that address. Check the spelling, then try again.';
    installServer({
      saveFails: { status: 400, body: { message, code: 'address_refused', field: 'baseUrl' } },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Any OpenAI-compatible service' }));
    await user.type(screen.getByLabelText('Address'), 'https://nope.invalid/v1');
    await user.type(screen.getByLabelText('Model name'), 'gpt-x');
    await user.type(screen.getByLabelText('Key'), 'some-key');
    await user.click(saveButton());

    const address = screen.getByLabelText('Address');
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(address).toHaveAttribute('aria-invalid', 'true');
    expect(address.getAttribute('aria-describedby')).toContain('ai-address-error');
    await waitFor(() => expect(address).toHaveFocus());
    expect(screen.getByLabelText('Model name')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('AI settings saved')).not.toBeInTheDocument();
  });

  it('clears the mark as soon as the address is edited', async () => {
    installServer({
      saveFails: {
        status: 400,
        body: { message: 'That address doesn\'t look right.', code: 'address_refused', field: 'baseUrl' },
      },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Any OpenAI-compatible service' }));
    await user.type(screen.getByLabelText('Address'), 'bad');
    await user.type(screen.getByLabelText('Model name'), 'gpt-x');
    await user.type(screen.getByLabelText('Key'), 'k');
    await user.click(saveButton());
    await screen.findByText("That address doesn't look right.");

    await user.type(screen.getByLabelText('Address'), 'x');

    expect(screen.queryByText("That address doesn't look right.")).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('opens the key box and focuses it when the server asks for a key that was hidden', async () => {
    const message = 'Enter your key to save these settings.';
    installServer({
      saved: makeView(),
      saveFails: { status: 400, body: { message, code: 'key_needed', field: 'apiKey' } },
    });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.click(saveButton());

    const key = await screen.findByLabelText('Key');
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(key).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(key).toHaveFocus());
  });

  it('shows the server message inside the card when no single input is to blame', async () => {
    const message = 'Too many saves. Wait a few minutes, then try again.';
    installServer({ saveFails: { status: 429, body: { message, code: 'rate_limited', field: null } } });
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText('Model name'), 'claude-sonnet-5-5');
    await user.type(screen.getByLabelText('Key'), 'sk-ant-abc');
    await user.click(saveButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Model name')).not.toHaveAttribute('aria-invalid', 'true');
    expect(saveButton()).toBeEnabled();
  });

  it('falls back to a plain sentence when the answer has no usable message', async () => {
    installServer({ saveFails: { status: 502, body: {} as { message: string } } });
    const user = userEvent.setup();
    renderPanel();

    await user.type(await screen.findByLabelText('Model name'), 'claude-sonnet-5-5');
    await user.type(screen.getByLabelText('Key'), 'sk-ant-abc');
    await user.click(saveButton());

    expect(await screen.findByText("The settings couldn't be saved. Try again.")).toBeInTheDocument();
  });
});

describe('AI settings: removing', () => {
  it('asks first, does nothing on Cancel, and empties the form after Remove', async () => {
    const server = installServer({ saved: makeView() });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Key saved, ends in …abcd');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Remove the AI settings?')).toBeInTheDocument();
    expect(within(dialog).getByText('The page assistant turns off for this site.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(server.findCall('DELETE')).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const again = await screen.findByRole('alertdialog');
    await user.click(within(again).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(server.findCall('DELETE')).toBeDefined());
    expect(server.findCall('DELETE')).toMatchObject({ path: '/api/ai-builder/settings', siteId: SITE_ID });
    expect(await screen.findByText('AI settings removed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Model name')).toHaveValue(''));
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByText('Key saved, ends in …abcd')).not.toBeInTheDocument();
  });

  it('does not offer Remove before anything is saved', async () => {
    installServer();
    renderPanel();

    await screen.findByLabelText('Model name');

    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});

describe('AI settings: telling local addresses from online ones', () => {
  it.each([
    ['http://localhost:11434/v1', true],
    ['http://127.0.0.1:8080/v1', true],
    ['http://192.168.1.20:1234/v1', true],
    ['http://172.20.0.5/v1', true],
    ['http://ollama:11434/v1', true],
    ['https://box.local/v1', true],
    ['https://openrouter.ai/api/v1', false],
    ['https://172.32.0.5/v1', false],
    ['https://api.example.com/v1', false],
    ['not an address', false],
    ['', false],
  ])('%s -> %s', (address, expected) => {
    expect(looksLocalAddress(address)).toBe(expected);
  });
});
