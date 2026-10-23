import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteChatFromBrowser,
  loadChatIndex,
  loadChatMessages,
  NEW_CHAT_TITLE,
  saveChatToBrowser,
  STORED_CHAT_LIMIT,
  type ChatSummary,
} from '@/components/PageBuilder/assistant/assistant-storage';
import { usePageAssistant } from '@/components/PageBuilder/assistant/use-page-assistant';

const PAGE_ID = 'page-history';
const LEGACY_KEY = `page-builder:assistant:${PAGE_ID}`;
const OLDER_AT = '2026-10-20T10:00:00.000Z';
const NEWER_AT = '2026-10-22T10:00:00.000Z';

const userMessage = (id: string, text: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });
const assistantMessage = (id: string, text: string): UIMessage => ({ id, role: 'assistant', parts: [{ type: 'text', text }] });

/** Two saved chats: "older" (Oct 20) and "newer" (Oct 22), newest first. */
const seedTwoChats = (): ChatSummary[] => {
  const older = saveChatToBrowser({
    pageId: PAGE_ID,
    chatId: 'older',
    messages: [userMessage('o1', 'Older request')],
    chats: [],
    now: OLDER_AT,
  });
  return saveChatToBrowser({
    pageId: PAGE_ID,
    chatId: 'newer',
    messages: [userMessage('n1', 'Newer request'), assistantMessage('n2', 'Done')],
    chats: older,
    now: NEWER_AT,
  });
};

const renderAssistant = () =>
  renderHook(() =>
    usePageAssistant({
      siteId: 'site-history',
      pageId: PAGE_ID,
      contentType: 'page',
      getBlocks: () => [],
      applyBlocks: vi.fn(),
    }),
  );

/** A reply stream that never finishes, so the assistant stays busy until it is stopped. */
const hangingReply = (): Response =>
  new Response(new ReadableStream({ start: () => undefined }), {
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('saved chats in this browser', () => {
  it('turns the single chat saved by the older version into one chat, then removes the old key', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([userMessage('m1', 'Add a hero section')]));

    const chats = loadChatIndex(PAGE_ID);

    expect(chats).toHaveLength(1);
    expect(chats[0]?.title).toBe('Add a hero section');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(loadChatMessages({ pageId: PAGE_ID, chatId: chats[0]?.id ?? '' })).toEqual([userMessage('m1', 'Add a hero section')]);
  });

  it('leaves the old key alone once the chat list has chats', () => {
    seedTwoChats();
    localStorage.setItem(LEGACY_KEY, JSON.stringify([userMessage('m9', 'Stale copy')]));

    expect(loadChatIndex(PAGE_ID).map((chat) => chat.id)).toEqual(['newer', 'older']);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it('titles a chat from the first request: whitespace collapsed, cut at 60 characters with an ellipsis', () => {
    const [titled] = saveChatToBrowser({
      pageId: PAGE_ID,
      chatId: 'spaced',
      messages: [userMessage('m1', '  Make   the hero\n bigger  ')],
      chats: [],
    });
    expect(titled?.title).toBe('Make the hero bigger');

    const [long] = saveChatToBrowser({
      pageId: PAGE_ID,
      chatId: 'long',
      messages: [userMessage('m2', 'word '.repeat(30))],
      chats: [],
    });
    expect(long?.title.endsWith('…')).toBe(true);
    expect(long?.title.length).toBeLessThanOrEqual(60);
  });

  it('shows "New chat" while a chat has no request text', () => {
    const [chat] = saveChatToBrowser({
      pageId: PAGE_ID,
      chatId: 'no-text',
      messages: [assistantMessage('a1', 'Hello')],
      chats: [],
    });
    expect(chat?.title).toBe(NEW_CHAT_TITLE);
  });

  it('keeps the first creation time, moves a chat to the top when it changes, and stores nothing for an empty chat', () => {
    const chats = seedTwoChats();
    const bumped = saveChatToBrowser({
      pageId: PAGE_ID,
      chatId: 'older',
      messages: [userMessage('o1', 'Older request'), assistantMessage('o2', 'Changed')],
      chats,
      now: '2026-10-23T09:00:00.000Z',
    });

    expect(bumped.map((chat) => chat.id)).toEqual(['older', 'newer']);
    expect(bumped[0]).toMatchObject({ createdAt: OLDER_AT, updatedAt: '2026-10-23T09:00:00.000Z' });

    const unchanged = saveChatToBrowser({ pageId: PAGE_ID, chatId: 'empty', messages: [], chats: bumped });
    expect(unchanged).toBe(bumped);
    expect(loadChatMessages({ pageId: PAGE_ID, chatId: 'empty' })).toEqual([]);
  });

  it('keeps the 20 newest chats per page and drops the oldest with its messages', () => {
    let chats: ChatSummary[] = [];
    for (let index = 0; index <= STORED_CHAT_LIMIT; index += 1) {
      chats = saveChatToBrowser({
        pageId: PAGE_ID,
        chatId: `chat-${index}`,
        messages: [userMessage(`m${index}`, `Request ${index}`)],
        chats,
        now: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
      });
    }

    expect(chats).toHaveLength(STORED_CHAT_LIMIT);
    expect(chats[0]?.id).toBe(`chat-${STORED_CHAT_LIMIT}`);
    expect(chats.at(-1)?.id).toBe('chat-1');
    expect(loadChatIndex(PAGE_ID)).toHaveLength(STORED_CHAT_LIMIT);
    expect(loadChatMessages({ pageId: PAGE_ID, chatId: 'chat-0' })).toEqual([]);
  });

  it('deletes one chat and its messages, and leaves the others', () => {
    const chats = seedTwoChats();
    const remaining = deleteChatFromBrowser({ pageId: PAGE_ID, chatId: 'newer', chats });

    expect(remaining.map((chat) => chat.id)).toEqual(['older']);
    expect(loadChatIndex(PAGE_ID).map((chat) => chat.id)).toEqual(['older']);
    expect(loadChatMessages({ pageId: PAGE_ID, chatId: 'newer' })).toEqual([]);
  });

  it('a browser that blocks site data gets empty reads, and a list that still shows this visit', () => {
    const blocked = (): never => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(loadChatIndex(PAGE_ID)).toEqual([]);
    expect(loadChatMessages({ pageId: PAGE_ID, chatId: 'any' })).toEqual([]);

    const saved = saveChatToBrowser({ pageId: PAGE_ID, chatId: 'visit', messages: [userMessage('m1', 'Hi')], chats: [] });
    expect(saved.map((chat) => chat.id)).toEqual(['visit']);
    expect(deleteChatFromBrowser({ pageId: PAGE_ID, chatId: 'visit', chats: saved })).toEqual([]);

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ atFunction: 'loadChatIndex', data: expect.objectContaining({ pageId: PAGE_ID }) }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ atFunction: 'saveChatToBrowser' }));
  });
});

describe('switching chats in the assistant', () => {
  it('opens on the newest saved chat with its messages', () => {
    seedTwoChats();
    const { result } = renderAssistant();

    expect(result.current.chats.map((chat) => chat.id)).toEqual(['newer', 'older']);
    expect(result.current.activeChatId).toBe('newer');
    expect(result.current.messages.map((message) => message.id)).toEqual(['n1', 'n2']);
  });

  it('opens an empty chat on a page with no history', () => {
    const { result } = renderAssistant();

    expect(result.current.chats).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.activeChatId).not.toBe('');
  });

  it('openChat swaps the messages and clears a shown error', () => {
    seedTwoChats();
    const { result } = renderAssistant();

    act(() => result.current.openChat('older'));

    expect(result.current.activeChatId).toBe('older');
    expect(result.current.messages.map((message) => message.id)).toEqual(['o1']);
    expect(result.current.errorText).toBeNull();
  });

  it('newChat starts an empty chat and keeps the old one in the list', () => {
    seedTwoChats();
    const { result } = renderAssistant();

    act(() => result.current.newChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.activeChatId).not.toBe('newer');
    expect(result.current.chats.map((chat) => chat.id)).toEqual(['newer', 'older']);
  });

  it('deleting the open chat starts a fresh one, and the other chats stay', () => {
    seedTwoChats();
    const { result } = renderAssistant();

    act(() => result.current.deleteChat('newer'));

    expect(result.current.messages).toEqual([]);
    expect(result.current.chats.map((chat) => chat.id)).toEqual(['older']);
    expect(loadChatIndex(PAGE_ID).map((chat) => chat.id)).toEqual(['older']);
  });

  it('deleting another chat keeps the open one as it was', () => {
    seedTwoChats();
    const { result } = renderAssistant();

    act(() => result.current.deleteChat('older'));

    expect(result.current.activeChatId).toBe('newer');
    expect(result.current.messages.map((message) => message.id)).toEqual(['n1', 'n2']);
    expect(result.current.chats.map((chat) => chat.id)).toEqual(['newer']);
  });

  it('does not switch, start, or delete while the assistant is working', async () => {
    seedTwoChats();
    vi.stubGlobal('fetch', vi.fn(async () => hangingReply()));
    const { result } = renderAssistant();

    act(() => result.current.send({ text: 'Make it bigger' }));
    await waitFor(() => expect(result.current.isLocked).toBe(true));

    act(() => result.current.openChat('older'));
    expect(result.current.activeChatId).toBe('newer');

    act(() => result.current.newChat());
    expect(result.current.activeChatId).toBe('newer');

    act(() => result.current.deleteChat('newer'));
    expect(result.current.chats.map((chat) => chat.id)).toEqual(['newer', 'older']);

    act(() => result.current.stop());
  });
});
