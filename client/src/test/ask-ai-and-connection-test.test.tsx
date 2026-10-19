import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ASSISTANT_MESSAGES, type AiChatRequest } from '@shared/ai-builder';
import type { BlockConfig } from '@shared/schema-types';
import { makeBlock } from '@shared/page-tools/test-support/memory-context';
import { AskAiButton, PageAssistantProvider } from '@/components/PageBuilder/assistant';
import { AiConnectionTest } from '@/components/settings/ai-settings/ai-connection-test';
import { TooltipProvider } from '@/components/ui/tooltip';

const SITE_ID = '3f2b8a40-6c1d-4a57-9e0b-5d7c1a2b9e11';
const PAGE_ID = '9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const HERO = makeBlock({ name: 'core/heading', id: 'hero', content: { value: 'Hello' } });
const SHORTER = { ...HERO, content: { ...(HERO.content as object), value: 'Hi' } } as BlockConfig;

const encoder = new TextEncoder();
const sse = (chunks: object[]): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } },
  );
const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const RUN = [
  { type: 'start', messageId: 'reply-1' },
  { type: 'start-step' },
  {
    type: 'data-page-change',
    transient: true,
    data: { ops: [], summary: { inserted: [], updated: ['hero'], deleted: [], moved: [], replaced: [] }, blocks: [SHORTER] },
  },
  { type: 'finish-step' },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'I made the heading shorter.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Ask AI on a block', () => {
  it('limits the run to that block, shows the answer, and Undo puts the block back', async () => {
    const chatBodies: AiChatRequest[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), 'http://localhost').pathname;
        if (path === '/api/ai-builder/status') return json({ enabled: true, canManage: false });
        chatBodies.push(JSON.parse(String(init?.body)) as AiChatRequest);
        return sse(RUN);
      }),
    );
    let tree: BlockConfig[] = [HERO];
    const applied: Array<{ ids: string; newStep: boolean }> = [];
    const selectBlock = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <PageAssistantProvider
            page={{ siteId: SITE_ID, pageId: PAGE_ID, contentType: 'page' }}
            getBlocks={() => tree}
            applyBlocks={(blocks, { newStep }) => {
              tree = blocks;
              applied.push({ ids: JSON.stringify(blocks.map((block) => (block.content as { value?: string }).value)), newStep });
            }}
            selectedBlockId={null}
            selectBlock={selectBlock}
            lockedRef={{ current: false }}>
            <AskAiButton blockId="hero" />
          </PageAssistantProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask AI about this block' }));
    expect(selectBlock).toHaveBeenCalledWith('hero');
    await user.type(screen.getByRole('textbox', { name: 'Message to the assistant' }), 'Make it shorter{Enter}');

    expect(await screen.findByText('I made the heading shorter.')).toBeTruthy();
    expect(chatBodies[0]?.focusBlockId).toBe('hero');
    expect(applied).toEqual([{ ids: '["Hi"]', newStep: true }]);

    await user.click(screen.getByRole('button', { name: /undo this change/i }));
    expect(applied.at(-1)).toEqual({ ids: '["Hello"]', newStep: true });
  });
});

describe('Test connection in Settings → AI', () => {
  const renderTest = () => render(<AiConnectionTest siteId={SITE_ID} />);

  it('says the connection works when the model used the tool', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(AI_ASSISTANT_MESSAGES.testOk)).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/ai-builder/settings/test');
  });

  it("shows the server's plain answer when the model can't use tools", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, code: 'no_tool_use', message: AI_ASSISTANT_MESSAGES.noToolUse })));
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(AI_ASSISTANT_MESSAGES.noToolUse)).toBeTruthy();
  });

  it('shows a plain line, not raw server text, when the test itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })));
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain("couldn't run"));
    expect(document.body.textContent).not.toContain('Bad Gateway');
  });
});
