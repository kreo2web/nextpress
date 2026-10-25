import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASSISTANT_CHAT_MESSAGES } from '@shared/assistant-chats';
import { usePageAssistant } from '@/components/PageBuilder/assistant/use-page-assistant';
import { createFakeChatServer, type FakeChatServer } from './fixtures/fake-chat-server';

const PAGE_ID = 'page-history';
const OLDER_AT = '2026-10-20T10:00:00.000Z';
const NEWER_AT = '2026-10-22T10:00:00.000Z';

const userMessage = (id: string, text: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });
const assistantMessage = (id: string, text: string): UIMessage => ({ id, role: 'assistant', parts: [{ type: 'text', text }] });

/** Two chats already on the server: "older" (Oct 20) and "newer" (Oct 22). */
const seedTwoChats = (server: FakeChatServer): void => {
  server.seed({ id: 'older', documentId: PAGE_ID, messages: [userMessage('o1', 'Older request')], updatedAt: OLDER_AT });
  server.seed({ id: 'newer', documentId: PAGE_ID, messages: [userMessage('n1', 'Newer request'), assistantMessage('n2', 'Done')], updatedAt: NEWER_AT });
};

const setup = (other: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async () => new Response('{}')) => {
  const server = createFakeChatServer();
  vi.stubGlobal('fetch', server.fetchWith(other));
  const view = renderHook(() =>
    usePageAssistant({ siteId: 'site-history', pageId: PAGE_ID, contentType: 'page', getBlocks: () => [], applyBlocks: vi.fn() }),
  );
  return { server, ...view };
};

const ids = (chats: Array<{ id: string }>): string[] => chats.map((chat) => chat.id);

/** A reply stream that never finishes, so the assistant stays busy until it is stopped. */
const hangingReply = async (): Promise<Response> =>
  new Response(new ReadableStream({ start: () => undefined }), {
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('saved chats on the server', () => {
  it('reads nothing until asked, then lists the server\'s chats newest first and opens the newest', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    expect(result.current.chats).toEqual([]);
    expect(server.calls).toHaveLength(0);

    act(() => result.current.refreshChats());

    await waitFor(() => expect(ids(result.current.chats)).toEqual(['newer', 'older']));
    await waitFor(() => expect(result.current.activeChatId).toBe('newer'));
    await waitFor(() => expect(result.current.messages.map((message) => message.id)).toEqual(['n1', 'n2']));
    expect(result.current.chatsStatus).toBe('ready');
    const listCall = server.calls.find((call) => call.method === 'GET' && call.chatId === null);
    expect(listCall).toBeTruthy();
  });

  it('asks only for this page\'s chats', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    server.seed({ id: 'elsewhere', documentId: 'another-page', messages: [userMessage('x1', 'Not here')] });

    act(() => result.current.refreshChats());

    await waitFor(() => expect(result.current.chatsStatus).toBe('ready'));
    expect(ids(result.current.chats)).toEqual(['newer', 'older']);
  });

  it('opens an empty chat on a page with no history', async () => {
    const { result } = setup();
    act(() => result.current.refreshChats());

    await waitFor(() => expect(result.current.chatsStatus).toBe('ready'));
    expect(result.current.chats).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.activeChatId).not.toBe('');
  });

  it('does not pull the newest chat in over a new chat the person already started', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    const startId = result.current.activeChatId;

    act(() => result.current.newChat());
    const freshId = result.current.activeChatId;
    expect(freshId).not.toBe(startId);
    act(() => result.current.refreshChats());

    await waitFor(() => expect(ids(result.current.chats)).toEqual(['newer', 'older']));
    expect(result.current.activeChatId).toBe(freshId);
    expect(result.current.messages).toEqual([]);
  });

  it('says so in plain words when the list can\'t be read, and does not open anything', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'x' }), { status: 500 })));
    const { result } = renderHook(() =>
      usePageAssistant({ siteId: 'site-history', pageId: PAGE_ID, contentType: 'page', getBlocks: () => [], applyBlocks: vi.fn() }),
    );

    act(() => result.current.refreshChats());

    await waitFor(() => expect(result.current.chatsStatus).toBe('error'));
    expect(result.current.chatsNotice).toBe(ASSISTANT_CHAT_MESSAGES.loadFailed);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ atFunction: 'useSavedChats.refresh', data: expect.objectContaining({ documentId: PAGE_ID, status: 500, error: expect.any(Error) }) }),
    );
  });

  it('openChat fetches the chat from the server and swaps the messages', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.openChat('older'));

    await waitFor(() => expect(result.current.messages.map((message) => message.id)).toEqual(['o1']));
    expect(result.current.activeChatId).toBe('older');
    expect(result.current.errorText).toBeNull();
  });

  it('a chat that can\'t be opened stays where it was and says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    server.chats.delete('older');

    act(() => result.current.openChat('older'));

    await waitFor(() => expect(result.current.chatsNotice).toBe(ASSISTANT_CHAT_MESSAGES.openFailed));
    expect(result.current.messages.map((message) => message.id)).toEqual(['n1', 'n2']);
  });

  it('newChat starts an empty chat and keeps the old one in the list', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.newChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.activeChatId).not.toBe('newer');
    expect(ids(result.current.chats)).toEqual(['newer', 'older']);
  });

  it('deleting the open chat removes it on the server and starts a fresh one; the other chats stay', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.deleteChat('newer'));

    expect(result.current.messages).toEqual([]);
    expect(ids(result.current.chats)).toEqual(['older']);
    await waitFor(() => expect([...server.chats.keys()]).toEqual(['older']));
  });

  it('deleting another chat keeps the open one as it was', async () => {
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.deleteChat('older'));

    expect(result.current.activeChatId).toBe('newer');
    expect(result.current.messages.map((message) => message.id)).toEqual(['n1', 'n2']);
    expect(ids(result.current.chats)).toEqual(['newer']);
    await waitFor(() => expect([...server.chats.keys()]).toEqual(['newer']));
  });

  it('a delete the server refuses puts the chat back in the list and says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { server, result } = setup();
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    const handle = server.handle;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE' ? new Response(JSON.stringify({ message: 'x' }), { status: 500 }) : (await handle(input, init)) ?? new Response('{}'),
    ));

    act(() => result.current.deleteChat('older'));

    await waitFor(() => expect(result.current.chatsNotice).toBe(ASSISTANT_CHAT_MESSAGES.deleteFailed));
    expect(ids(result.current.chats)).toEqual(['newer', 'older']);
  });

  it('does not switch, start, or delete while the assistant is working', async () => {
    const { server, result } = setup(hangingReply);
    seedTwoChats(server);
    act(() => result.current.refreshChats());
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.send({ text: 'Make it bigger' }));
    await waitFor(() => expect(result.current.isLocked).toBe(true));

    act(() => result.current.openChat('older'));
    expect(result.current.activeChatId).toBe('newer');
    act(() => result.current.newChat());
    expect(result.current.activeChatId).toBe('newer');
    act(() => result.current.deleteChat('newer'));
    expect(ids(result.current.chats)).toEqual(['newer', 'older']);
    expect(server.calls.some((call) => call.method === 'DELETE')).toBe(false);

    act(() => result.current.stop());
  });
});

describe('chats left in this browser by the older version', () => {
  it('move to the server when the chats are first read, and leave this browser', async () => {
    localStorage.setItem(
      'page-builder:assistant:chats:page-history',
      JSON.stringify([{ id: 'old-1', title: 'Old', createdAt: OLDER_AT, updatedAt: OLDER_AT }]),
    );
    localStorage.setItem('page-builder:assistant:chat:page-history:old-1', JSON.stringify([userMessage('l1', 'Kept in the browser')]));
    const { server, result } = setup();

    act(() => result.current.refreshChats());

    await waitFor(() => expect(result.current.chats).toHaveLength(1));
    expect(result.current.chats[0]?.title).toBe('Kept in the browser');
    expect(server.saves()).toHaveLength(1);
    expect(localStorage.length).toBe(0);
    await waitFor(() => expect(result.current.messages.map((message) => message.id)).toEqual(['l1']));
  });

  it('stay in this browser while the server can\'t take them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(`page-builder:assistant:${PAGE_ID}`, JSON.stringify([userMessage('l1', 'Only copy')]));
    const { server, result } = setup();
    server.failNextSaves({ count: 1, status: 500 });

    act(() => result.current.refreshChats());

    await waitFor(() => expect(result.current.chatsStatus).toBe('ready'));
    expect(result.current.chats).toEqual([]);
    expect(localStorage.getItem(`page-builder:assistant:${PAGE_ID}`)).not.toBeNull();
  });
});
