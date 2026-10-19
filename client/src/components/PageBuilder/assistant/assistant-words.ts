import { AI_ASSISTANT_MESSAGES, type AiPageChangeSummary } from '@shared/ai-builder';
import { findBlockEntry } from '@shared/block-catalog';

/** What a tool step is doing, in the person's words. The tool names stay out of the screen. */
const READ_STEPS: Record<string, string> = {
  get_page_outline: 'Reading the page',
  get_block: 'Looking at a block',
  list_block_types: 'Checking which blocks it can use',
  get_block_type: 'Checking how a block works',
  get_design_guide: 'Reading the design guide',
  check_page: 'Checking the page',
  apply_phone_fixes: 'Fixing the layout for phones',
  list_media: 'Looking through your media',
  list_pages: 'Looking at your pages',
  list_template_parts: 'Looking at your template parts',
  get_theme: 'Reading your theme',
};

type ChangeOp = { op?: string; block?: { name?: string } };

const blockLabel = (name: string | undefined): string =>
  (name ? findBlockEntry(name)?.label : undefined) ?? 'a block';

const readOps = (input: object | undefined): ChangeOp[] => {
  const ops = (input as { ops?: ChangeOp[] } | undefined)?.ops;
  return Array.isArray(ops) ? ops : [];
};

const describeOneOp = (op: ChangeOp): string => {
  if (op.op === 'insert') return `Adding ${blockLabel(op.block?.name)}`;
  if (op.op === 'replace') return `Replacing a block with ${blockLabel(op.block?.name)}`;
  if (op.op === 'delete') return 'Removing a block';
  if (op.op === 'move') return 'Moving a block';
  return 'Updating a block';
};

/** One line for a tool step, e.g. "Adding Heading…" while it runs and "Adding Heading" once done. */
export const describeToolStep = ({
  toolName,
  input,
  done,
}: {
  toolName: string;
  input?: object;
  done: boolean;
}): string => {
  const ellipsis = done ? '' : '…';
  if (toolName !== 'change_blocks') return `${READ_STEPS[toolName] ?? 'Working on the page'}${ellipsis}`;
  const ops = readOps(input);
  if (ops.length === 0) return `Changing the page${ellipsis}`;
  if (ops.length === 1 && ops[0]) return `${describeOneOp(ops[0])}${ellipsis}`;
  return `Making ${ops.length} changes${ellipsis}`;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The short "what changed" line under a reply, or null when nothing changed. */
export const describePageChanges = (summary: AiPageChangeSummary): string | null => {
  const parts = [
    summary.inserted.length > 0 ? `added ${plural(summary.inserted.length, 'block')}` : null,
    summary.updated.length + summary.replaced.length > 0
      ? `changed ${plural(summary.updated.length + summary.replaced.length, 'block')}`
      : null,
    summary.moved.length > 0 ? `moved ${plural(summary.moved.length, 'block')}` : null,
    summary.deleted.length > 0 ? `removed ${plural(summary.deleted.length, 'block')}` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

/** Adds one change's ids to the running total for a reply. */
export const mergeChangeSummaries = (a: AiPageChangeSummary, b: AiPageChangeSummary): AiPageChangeSummary => ({
  inserted: [...new Set([...a.inserted, ...b.inserted])],
  updated: [...new Set([...a.updated, ...b.updated])],
  deleted: [...new Set([...a.deleted, ...b.deleted])],
  moved: [...new Set([...a.moved, ...b.moved])],
  replaced: [...new Set([...a.replaced, ...b.replaced])],
});

export const EMPTY_CHANGE_SUMMARY: AiPageChangeSummary = { inserted: [], updated: [], deleted: [], moved: [], replaced: [] };

const KNOWN_MESSAGES = new Set<string>(Object.values(AI_ASSISTANT_MESSAGES));

const FALLBACK_ERROR = "The assistant couldn't finish. Try again.";
const OFFLINE_ERROR = "Couldn't reach the server. Check your connection, then try again.";

/**
 * The sentence to show for a failed run. The server already answers in plain words, either as a JSON
 * body (refused before the run) or as the stream's error text; anything else gets a generic line.
 */
export const readAssistantError = (error: Error | undefined): string | null => {
  if (!error) return null;
  const text = error.message.trim();
  if (KNOWN_MESSAGES.has(text)) return text;
  if (text.startsWith('{')) {
    try {
      const body = JSON.parse(text) as { message?: string };
      if (typeof body.message === 'string' && body.message.trim() !== '') return body.message;
    } catch (parseError) {
      console.error({
        atFunction: 'readAssistantError',
        data: { error: parseError },
        message: 'The assistant error body was not in the expected shape',
      });
    }
  }
  if (error.name === 'TypeError' || /failed to fetch|network/i.test(text)) return OFFLINE_ERROR;
  return FALLBACK_ERROR;
};
