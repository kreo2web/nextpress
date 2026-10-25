import type { UIMessage } from 'ai';
import { vi } from 'vitest';

const CHATS_PATH = '/api/assistant/chats';

type StoredChat = { id: string; title: string; createdAt: string; updatedAt: string; documentId: string; messages: UIMessage[] };

export type ChatCall = { method: string; chatId: string | null; body: { messages?: UIMessage[]; documentId?: string; documentKind?: string; siteId?: string } | null };

const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const firstText = (messages: UIMessage[]): string =>
  messages.flatMap((message) => (message.role === 'user' ? message.parts : [])).flatMap((part) => (part.type === 'text' ? [part.text] : []))[0] ?? 'New chat';

/**
 * An in-memory stand-in for `/api/assistant/chats`, for tests that stub `fetch`. It keeps what is saved, answers
 * the list newest first, and can be told to fail the next saves. `handle` answers null for any other address so a
 * test's own stub can take over.
 */
export const createFakeChatServer = () => {
  const chats = new Map<string, StoredChat>();
  const calls: ChatCall[] = [];
  let tick = 0;
  let failures: { remaining: number; status: number } = { remaining: 0, status: 500 };

  const stamp = (): string => new Date(Date.UTC(2026, 9, 24, 12, 0, tick++)).toISOString();

  const handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> => {
    const url = new URL(String(input), 'http://localhost');
    if (!url.pathname.startsWith(CHATS_PATH)) return null;
    const method = init?.method ?? 'GET';
    const chatId = url.pathname.slice(CHATS_PATH.length + 1) || null;
    const body = init?.body ? (JSON.parse(String(init.body)) as ChatCall['body']) : null;
    calls.push({ method, chatId, body });

    if (method === 'GET' && !chatId) {
      const documentId = url.searchParams.get('documentId');
      const list = [...chats.values()]
        .filter((chat) => chat.documentId === documentId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
      return json({ chats: list });
    }
    const found = chatId ? chats.get(chatId) : undefined;
    if (method === 'GET') return found ? json({ chat: found }) : json({ message: 'That chat could not be found.', code: 'chat_missing' }, 404);
    if (method === 'DELETE') {
      if (!found || !chatId) return json({ message: 'That chat could not be found.', code: 'chat_missing' }, 404);
      chats.delete(chatId);
      return json({ ok: true });
    }
    if (method === 'PUT' && chatId && body?.messages) {
      if (failures.remaining > 0) {
        failures = { ...failures, remaining: failures.remaining - 1 };
        return json({ message: 'This chat couldn\'t be saved. Try again.', code: 'save_failed' }, failures.status);
      }
      const now = stamp();
      const saved: StoredChat = {
        id: chatId,
        title: firstText(body.messages),
        createdAt: found?.createdAt ?? now,
        updatedAt: now,
        documentId: body.documentId ?? '',
        messages: body.messages,
      };
      chats.set(chatId, saved);
      return json({ chat: saved });
    }
    return json({ message: 'Unexpected request', code: 'invalid_request' }, 400);
  };

  return {
    chats,
    calls,
    handle,
    /** Puts a chat on the server as if it had been saved earlier. */
    seed: ({ id, documentId, messages, updatedAt = stamp() }: { id: string; documentId: string; messages: UIMessage[]; updatedAt?: string }): void => {
      chats.set(id, { id, title: firstText(messages), createdAt: updatedAt, updatedAt, documentId, messages });
    },
    /** The next `count` saves fail with `status`. */
    failNextSaves: ({ count, status = 500 }: { count: number; status?: number }): void => {
      failures = { remaining: count, status };
    },
    saves: (): ChatCall[] => calls.filter((call) => call.method === 'PUT'),
    /** Wraps a test's own fetch: chat addresses go to this server, the rest to `other`. */
    fetchWith: (other: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) =>
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => (await handle(input, init)) ?? other(input, init)),
  };
};

export type FakeChatServer = ReturnType<typeof createFakeChatServer>;
