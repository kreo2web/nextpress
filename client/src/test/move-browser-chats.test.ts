import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from 'ai';
import { moveBrowserChats } from '@/components/PageBuilder/assistant/move-browser-chats';
import type { saveChat } from '@/components/PageBuilder/assistant/assistant-chats-api';
import { readLeftoverChats } from '@/components/PageBuilder/assistant/assistant-storage';

const DOCUMENT = { siteId: 'site-1', documentKind: 'page' as const, documentId: 'p1' };
const user = (id: string, text: string): UIMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

const seed = (chats: Array<{ id: string; at: string; text: string }>): void => {
  localStorage.setItem(
    'page-builder:assistant:chats:p1',
    JSON.stringify(chats.map((chat) => ({ id: chat.id, title: chat.text, createdAt: chat.at, updatedAt: chat.at }))),
  );
  chats.forEach((chat) => localStorage.setItem(`page-builder:assistant:chat:p1:${chat.id}`, JSON.stringify([user(`m-${chat.id}`, chat.text)])));
};

type SendParams = Parameters<typeof saveChat>[0];
const summary = { id: 'x', title: 't', createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z' };

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('moving chats saved in this browser to the server', () => {
  it('uploads oldest first with new ids, and clears each local chat once the server confirmed it', async () => {
    seed([
      { id: 'newer', at: '2026-10-22T10:00:00.000Z', text: 'Newer ask' },
      { id: 'older', at: '2026-10-20T10:00:00.000Z', text: 'Older ask' },
    ]);
    const send = vi.fn(async (_params: SendParams) => summary);

    const result = await moveBrowserChats({ document: DOCUMENT, send });

    expect(result).toEqual({ moved: 2, kept: 0 });
    expect(send.mock.calls.map(([params]) => JSON.stringify(params.messages))).toEqual([
      expect.stringContaining('Older ask'),
      expect.stringContaining('Newer ask'),
    ]);
    const ids = send.mock.calls.map(([params]) => params.chatId);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
    expect(send.mock.calls[0]?.[0].document).toEqual(DOCUMENT);
    expect(localStorage.length).toBe(0);
  });

  it('keeps a chat in this browser when the server did not confirm it, and still moves the others', async () => {
    seed([
      { id: 'newer', at: '2026-10-22T10:00:00.000Z', text: 'Newer ask' },
      { id: 'older', at: '2026-10-20T10:00:00.000Z', text: 'Older ask' },
    ]);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const send = vi.fn(async ({ messages }: { messages: UIMessage[] }) => {
      if (JSON.stringify(messages).includes('Older ask')) throw new Error('server down');
      return summary;
    });

    const result = await moveBrowserChats({ document: DOCUMENT, send });

    expect(result).toEqual({ moved: 1, kept: 1 });
    expect(readLeftoverChats('p1').map((chat) => chat.chatId)).toEqual(['older']);
    expect(localStorage.getItem('page-builder:assistant:chat:p1:newer')).toBeNull();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ atFunction: 'moveBrowserChats', data: expect.objectContaining({ documentId: 'p1', chatId: 'older', error: expect.any(Error) }) }),
    );
  });

  it('does nothing when nothing is saved here', async () => {
    const send = vi.fn(async () => summary);
    expect(await moveBrowserChats({ document: DOCUMENT, send })).toEqual({ moved: 0, kept: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
