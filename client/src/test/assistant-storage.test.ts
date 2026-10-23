import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadChatIndex,
  loadChatMessages,
  saveChatToBrowser,
  setPendingDescription,
  takePendingDescription,
} from '@/components/PageBuilder/assistant/assistant-storage';

const blocked = (): never => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('assistant data kept in the browser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps chats per page and takes a waiting description only once', () => {
    const message = { id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hi' }] };
    const chats = saveChatToBrowser({ pageId: 'p1', chatId: 'c1', messages: [message], chats: [] });
    expect(loadChatIndex('p1')).toEqual(chats);
    expect(loadChatMessages({ pageId: 'p1', chatId: 'c1' })).toEqual([message]);
    expect(loadChatIndex('p2')).toEqual([]);

    setPendingDescription({ pageId: 'p1', description: 'A bakery page' });
    expect(takePendingDescription('p1')).toBe('A bakery page');
    expect(takePendingDescription('p1')).toBeNull();
  });

  it('a browser that blocks site data never breaks the waiting description', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => setPendingDescription({ pageId: 'p1', description: 'x' })).not.toThrow();
    expect(takePendingDescription('p1')).toBeNull();
  });

  it('a damaged saved list, chat or old single chat opens empty', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('page-builder:assistant:chats:p1', '{not json');
    localStorage.setItem('page-builder:assistant:chat:p1:c1', '{not json');
    localStorage.setItem('page-builder:assistant:p2', '{not json');

    expect(loadChatIndex('p1')).toEqual([]);
    expect(loadChatMessages({ pageId: 'p1', chatId: 'c1' })).toEqual([]);
    expect(loadChatIndex('p2')).toEqual([]);
  });
});
