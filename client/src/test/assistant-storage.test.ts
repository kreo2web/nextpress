import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAssistantMessages,
  loadAssistantMessages,
  saveAssistantMessages,
  setPendingDescription,
  takePendingDescription,
} from '@/components/PageBuilder/assistant/assistant-storage';

const blocked = (): never => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('assistant chat kept in the browser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the chat per page and takes a waiting description only once', () => {
    const message = { id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hi' }] };
    saveAssistantMessages({ pageId: 'p1', messages: [message] });
    expect(loadAssistantMessages('p1')).toEqual([message]);
    expect(loadAssistantMessages('p2')).toEqual([]);

    setPendingDescription({ pageId: 'p1', description: 'A bakery page' });
    expect(takePendingDescription('p1')).toBe('A bakery page');
    expect(takePendingDescription('p1')).toBeNull();
  });

  it('a browser that blocks site data starts with an empty chat instead of crashing the editor', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(loadAssistantMessages('p1')).toEqual([]);
    expect(() => saveAssistantMessages({ pageId: 'p1', messages: [] })).not.toThrow();
    expect(() => clearAssistantMessages('p1')).not.toThrow();
    expect(() => setPendingDescription({ pageId: 'p1', description: 'x' })).not.toThrow();
    expect(takePendingDescription('p1')).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ atFunction: 'loadAssistantMessages', data: expect.objectContaining({ pageId: 'p1' }) }));
  });

  it('a damaged saved chat starts empty', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('page-builder:assistant:p1', '{not json');
    expect(loadAssistantMessages('p1')).toEqual([]);
  });
});
