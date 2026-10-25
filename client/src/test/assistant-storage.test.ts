import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_CHAT_ID,
  readLeftoverChats,
  removeLeftoverChat,
  setPendingDescription,
  takePendingDescription,
} from '@/components/PageBuilder/assistant/assistant-storage';

const blocked = (): never => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

const message = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });

/** What the previous version wrote: a list under one key and each chat's messages under its own. */
const seedOldChats = (): void => {
  localStorage.setItem(
    'page-builder:assistant:chats:p1',
    JSON.stringify([
      { id: 'newer', title: 'Newer', createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-22T10:00:00.000Z' },
      { id: 'older', title: 'Older', createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' },
    ]),
  );
  localStorage.setItem('page-builder:assistant:chat:p1:newer', JSON.stringify([message('n1', 'Newer ask')]));
  localStorage.setItem('page-builder:assistant:chat:p1:older', JSON.stringify([message('o1', 'Older ask')]));
};

describe('chats an older version kept in this browser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads them oldest first, per page, so the move keeps their order', () => {
    seedOldChats();
    expect(readLeftoverChats('p1').map((chat) => chat.chatId)).toEqual(['older', 'newer']);
    expect(readLeftoverChats('p2')).toEqual([]);
  });

  it('reads the first version\'s single chat only when there is no chat list', () => {
    localStorage.setItem('page-builder:assistant:p1', JSON.stringify([message('m1', 'Hi')]));
    expect(readLeftoverChats('p1').map((chat) => chat.chatId)).toEqual([LEGACY_CHAT_ID]);

    seedOldChats();
    expect(readLeftoverChats('p1').map((chat) => chat.chatId)).toEqual(['older', 'newer']);
  });

  it('removing a chat leaves the others, and the list is dropped with the last one', () => {
    seedOldChats();
    removeLeftoverChat({ pageId: 'p1', chatId: 'older' });
    expect(readLeftoverChats('p1').map((chat) => chat.chatId)).toEqual(['newer']);
    expect(localStorage.getItem('page-builder:assistant:chat:p1:older')).toBeNull();

    removeLeftoverChat({ pageId: 'p1', chatId: 'newer' });
    expect(localStorage.getItem('page-builder:assistant:chats:p1')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('removing the single old chat clears its key', () => {
    localStorage.setItem('page-builder:assistant:p1', JSON.stringify([message('m1', 'Hi')]));
    removeLeftoverChat({ pageId: 'p1', chatId: LEGACY_CHAT_ID });
    expect(localStorage.length).toBe(0);
  });

  it('damaged data reads as nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('page-builder:assistant:chats:p1', '{not json');
    localStorage.setItem('page-builder:assistant:p2', '{not json');
    expect(readLeftoverChats('p1')).toEqual([]);
    expect(readLeftoverChats('p2')).toEqual([]);
  });

  it('a browser that blocks site data never breaks reading or removing them', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(readLeftoverChats('p1')).toEqual([]);
    expect(() => removeLeftoverChat({ pageId: 'p1', chatId: 'x' })).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ atFunction: 'readLeftoverChats', data: expect.objectContaining({ pageId: 'p1' }) }));
  });
});

describe('the description "Describe your page" leaves for the editor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('is taken only once', () => {
    setPendingDescription({ pageId: 'p1', description: 'A bakery page' });
    expect(takePendingDescription('p1')).toBe('A bakery page');
    expect(takePendingDescription('p1')).toBeNull();
  });

  it('a browser that blocks site data never breaks it', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => setPendingDescription({ pageId: 'p1', description: 'x' })).not.toThrow();
    expect(takePendingDescription('p1')).toBeNull();
  });
});
