import { vi } from 'vitest';

/** One request a test's page made: its method, its address (path and query) and what it sent. */
export type FakeCall = { method: string; url: string; body: Record<string, unknown> | null };

/** What a route answers with. `json` is sent as JSON; `body` as plain text (for downloads). */
export type FakeReply = { status?: number; json?: object; body?: string; headers?: Record<string, string> };

type Route = FakeReply | ((call: FakeCall) => FakeReply | Promise<FakeReply>);

/**
 * Routes are keyed `"METHOD /path?query"`. A key ending in `*` matches any address that starts with
 * it, so `"GET /api/docs/home-1/*"` answers every call under that docs. The first matching key wins.
 */
export type FakeRoutes = Record<string, Route>;

const matches = ({ key, method, url }: { key: string; method: string; url: string }): boolean => {
  const space = key.indexOf(' ');
  const keyMethod = key.slice(0, space);
  const keyUrl = key.slice(space + 1);
  if (keyMethod !== method) return false;
  return keyUrl.endsWith('*') ? url.startsWith(keyUrl.slice(0, -1)) : url === keyUrl;
};

const toResponse = (reply: FakeReply): Response => {
  const { status = 200, json, body, headers = {} } = reply;
  const text = json !== undefined ? JSON.stringify(json) : (body ?? '');
  const type: Record<string, string> = json !== undefined ? { 'content-type': 'application/json' } : {};
  return new Response(status === 204 ? null : text, { status, headers: { ...type, ...headers } });
};

const readBody = (init?: RequestInit): FakeCall['body'] => {
  if (typeof init?.body !== 'string' || init.body === '') return null;
  return JSON.parse(init.body) as Record<string, unknown>;
};

/**
 * Replaces `fetch` with a table of answers and records every call. A request nothing answers fails
 * the test loudly, so a screen can't quietly depend on something the test forgot to set up.
 */
export const installFakeFetch = (routes: FakeRoutes) => {
  const calls: FakeCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const parsed = new URL(String(input), 'http://localhost');
    const call: FakeCall = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url: `${parsed.pathname}${parsed.search}`,
      body: readBody(init),
    };
    calls.push(call);
    const key = Object.keys(routes).find((candidate) => matches({ key: candidate, method: call.method, url: call.url }));
    if (!key) throw new Error(`No fake answer for ${call.method} ${call.url}`);
    const route = routes[key];
    return toResponse(typeof route === 'function' ? await route(call) : route);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    fetchMock,
    /** The calls made with this method to an address that starts with `prefix`. */
    callsTo: ({ method, prefix }: { method: string; prefix: string }): FakeCall[] =>
      calls.filter((call) => call.method === method && call.url.startsWith(prefix)),
  };
};
