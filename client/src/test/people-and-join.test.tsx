import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InviteSummary, InviteView } from '@shared/invites';

const auth = vi.hoisted(() => ({ isAuthenticated: false, user: undefined as { id: string; email: string } | undefined }));
const signIn = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const signUp = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: signIn }, signUp: { email: signUp }, signOut: vi.fn() } }));

const { default: Register } = await import('@/pages/Register');
const { default: JoinPage } = await import('@/pages/Join');
const { InviteDialog } = await import('@/components/people/invite-dialog');

type Call = { method: string; path: string; body: Record<string, unknown> | null };
const calls: Call[] = [];
const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers the few addresses these screens use; every call is recorded. */
const installServer = (routes: Record<string, (body: Record<string, unknown> | null) => Response>): void => {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method, path: url.pathname, body });
    const route = routes[`${method} ${url.pathname}`];
    return route ? route(body) : json({ message: 'not found' }, 404);
  });
};

const withQueries = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  calls.length = 0;
  auth.isAuthenticated = false;
  auth.user = undefined;
  signIn.mockClear();
  signUp.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('visitor sign-up page', () => {
  it('says sign-up is closed and points to an invite, with no form, when the site takes no accounts', async () => {
    installServer({ 'GET /api/public/sign-up-status': () => json({ open: false, siteName: 'Site A' }) });
    render(withQueries(<Register />));
    expect(await screen.findByText('Sign-up is closed')).toBeInTheDocument();
    expect(screen.getByText(/invite link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('offers a short form with no role choice when the site takes visitor accounts', async () => {
    installServer({ 'GET /api/public/sign-up-status': () => json({ open: true, siteName: 'Site A' }) });
    render(withQueries(<Register />));
    expect(await screen.findByText('Create an account on Site A')).toBeInTheDocument();
    expect(screen.queryByText(/role/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    expect(screen.getByText('Fill in every field to continue.')).toBeInTheDocument();
  });
});

describe('join page', () => {
  const view: InviteView = { siteName: 'Site B', role: 'editor', state: 'open', placesLeft: 2, expiresAt: null };

  it('makes the account through the link, then signs the person in', async () => {
    installServer({
      'GET /api/invites/code/abcdefghijklmnopqrstuvwx': () => json(view),
      'POST /api/invites/code/abcdefghijklmnopqrstuvwx/join': () => json({ siteId: 'site-b', role: 'editor', createdAccount: true }, 201),
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, set href(value: string) { assign(value); } });

    render(withQueries(<JoinPage code="abcdefghijklmnopqrstuvwx" />));
    expect(await screen.findByText(/invited to/)).toHaveTextContent('Site B');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ann' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ann@test.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-enough-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ email: 'ann@test.local', password: 'long-enough-1' }));
    const join = calls.find((call) => call.method === 'POST');
    expect(join?.body).toEqual({ name: 'Ann', username: 'ann', email: 'ann@test.local', password: 'long-enough-1' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/dashboard'));
  });

  it('explains a link that has no places left instead of showing a form', async () => {
    installServer({ 'GET /api/invites/code/abcdefghijklmnopqrstuvwx': () => json({ ...view, state: 'full', placesLeft: 0 }) });
    render(withQueries(<JoinPage code="abcdefghijklmnopqrstuvwx" />));
    expect(await screen.findByText(/no places left/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
});

describe('invite dialog', () => {
  it('sends the chosen role, places and end, then shows the link to copy', async () => {
    const made: InviteSummary = {
      id: 'i1', siteId: 'site-b', role: 'admin', code: 'c'.repeat(24), path: `/join/${'c'.repeat(24)}`, note: null,
      maxUses: null, uses: 0, placesLeft: null, expiresAt: null, state: 'open', createdAt: null,
    };
    installServer({
      'POST /api/invites': () => json(made, 201),
      'GET /api/invites': () => json({ invites: [] }),
    });
    render(withQueries(<InviteDialog open onOpenChange={() => undefined} siteId="site-b" siteUrl="https://b.example" myStanding="owner" />));

    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Never' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make link' }));

    expect(await screen.findByDisplayValue(`https://b.example/join/${'c'.repeat(24)}`)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ siteId: 'site-b', role: 'admin', maxUses: null, expiresInDays: null });
  });

  it("an editor can't offer a role above their own", () => {
    installServer({});
    render(withQueries(<InviteDialog open onOpenChange={() => undefined} siteId="site-b" siteUrl={null} myStanding="editor" />));
    expect(screen.getByRole('button', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
