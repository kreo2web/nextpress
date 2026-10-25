import { describe, expect, it, vi } from 'vitest';
import type { UIMessage } from 'ai';
import { createChatSaver, type SaveProblem } from '@/components/PageBuilder/assistant/create-chat-saver';

const DOCUMENT = { siteId: 'site-1', documentKind: 'page' as const, documentId: 'p1' };
const message = (text: string): UIMessage => ({ id: text, role: 'user', parts: [{ type: 'text', text }] });
const summary = (id: string) => ({ id, title: 't', createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:01.000Z' });

const httpError = (status: number): Error => Object.assign(new Error('failed'), { status });

/** Waits are recorded, not slept, so a retry costs no time. */
const instant = () => {
  const waits: number[] = [];
  return { waits, timing: { sleep: async (ms: number) => void waits.push(ms), random: () => 0.5 } };
};

const setup = ({ send }: { send: Parameters<typeof createChatSaver>[0]['send'] }) => {
  const saved: string[] = [];
  const problems: Array<SaveProblem | null> = [];
  const clock = instant();
  const saver = createChatSaver({
    document: DOCUMENT,
    send,
    timing: clock.timing,
    events: { onSaved: ({ chatId }) => void saved.push(chatId), onProblem: ({ problem }) => void problems.push(problem) },
  });
  const settle = () => vi.waitFor(() => expect(saver.unsavedIds()).toEqual([]));
  return { saver, saved, problems, clock, settle };
};

describe('saving a chat with retries', () => {
  it('sends the chat once and reports it saved', async () => {
    const send = vi.fn(async ({ chatId }: { chatId: string }) => summary(chatId));
    const { saver, saved, settle, problems } = setup({ send });

    saver.save({ chatId: 'c1', messages: [message('a')] });
    expect(saver.readUnsaved('c1')).toEqual([message('a')]);
    await settle();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ chatId: 'c1', document: DOCUMENT });
    expect(saved).toEqual(['c1']);
    expect(problems.at(-1)).toBeNull();
    expect(saver.readUnsaved('c1')).toBeNull();
  });

  it('retries with growing, jittered waits, stays quiet for the first failure, then says so, then clears it', async () => {
    let calls = 0;
    const send = vi.fn(async ({ chatId }: { chatId: string }) => {
      calls += 1;
      if (calls < 4) throw httpError(503);
      return summary(chatId);
    });
    const { saver, saved, problems, clock, settle } = setup({ send });

    saver.save({ chatId: 'c1', messages: [message('a')] });
    await settle();

    expect(send).toHaveBeenCalledTimes(4);
    expect(clock.waits).toEqual([1500, 3000, 6000]);
    expect(problems).toEqual(['retrying', 'retrying', null]);
    expect(saved).toEqual(['c1']);
  });

  it('a network failure is retried too', async () => {
    let calls = 0;
    const send = vi.fn(async ({ chatId }: { chatId: string }) => {
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      return summary(chatId);
    });
    const { saver, settle } = setup({ send });
    saver.save({ chatId: 'c1', messages: [message('a')] });
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('folds saves made while one is running into the newest, and sends the newest on the next try', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const sent: string[][] = [];
    const send = vi.fn(async ({ chatId, messages }: { chatId: string; messages: UIMessage[] }) => {
      sent.push(messages.map((entry) => entry.id));
      if (sent.length === 1) await gate;
      return summary(chatId);
    });
    const { saver, settle } = setup({ send });

    saver.save({ chatId: 'c1', messages: [message('a')] });
    saver.save({ chatId: 'c1', messages: [message('a'), message('b')] });
    saver.save({ chatId: 'c1', messages: [message('a'), message('b'), message('c')] });
    release();
    await settle();

    expect(sent).toEqual([['a'], ['a', 'b', 'c']]);
  });

  it('gives up on a chat the server refuses for good: no retry, a plain problem, the chat stays in memory', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const send = vi.fn(async () => {
      throw httpError(413);
    });
    const { saver, problems, clock } = setup({ send });

    saver.save({ chatId: 'c1', messages: [message('a')] });
    await vi.waitFor(() => expect(problems).toEqual(['too-long']));

    expect(send).toHaveBeenCalledTimes(1);
    expect(clock.waits).toEqual([]);
    expect(saver.readUnsaved('c1')).toEqual([message('a')]);
    expect(console.error).toHaveBeenCalledWith(
      expect.objectContaining({ atFunction: 'createChatSaver', data: expect.objectContaining({ chatId: 'c1', status: 413, documentId: 'p1' }) }),
    );
  });

  it('a refusal that will not change (signed out, no access) is reported as refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const send = vi.fn(async () => {
      throw httpError(403);
    });
    const { saver, problems } = setup({ send });
    saver.save({ chatId: 'c1', messages: [message('a')] });
    await vi.waitFor(() => expect(problems).toEqual(['refused']));
  });

  it('a deleted chat is not saved any more, and discard waits for the request in flight', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const send = vi.fn(async ({ chatId }: { chatId: string }) => {
      await gate;
      return summary(chatId);
    });
    const { saver, saved } = setup({ send });

    saver.save({ chatId: 'c1', messages: [message('a')] });
    const discarded = saver.discard('c1');
    release();
    await discarded;

    expect(saved).toEqual([]);
    expect(saver.unsavedIds()).toEqual([]);
  });

  it('after the editor closes it neither retries nor reports', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const send = vi.fn(async () => {
      throw httpError(500);
    });
    const { saver, problems } = setup({ send });
    saver.dispose();
    saver.save({ chatId: 'c1', messages: [message('a')] });
    expect(send).not.toHaveBeenCalled();
    expect(problems).toEqual([]);
  });
});
