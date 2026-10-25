import type { BlockConfig, Page, Post } from '@shared/schema-types';
import { stripVisualContentFromBlocks } from '@shared/strip-visual-content-from-blocks';

export type PublishAction = 'publish' | 'unpublish';

export type PublishPayload = {
  blocks: BlockConfig[];
  status: 'publish' | 'draft';
  publishedAt: string | null;
  slug: string;
  expectedVersion: number;
  siteId?: string;
  /** The page's title and settings as edited, when the editor holds them apart from its blocks (the docs editor). */
  title?: string;
  other?: Record<string, unknown>;
};

/** What the editor adds to a publish beyond the blocks: edits that would otherwise stay behind in the draft. */
export type PublishExtra = { title?: string; other?: Record<string, unknown> };

const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Builds publish requests from the current editor tree.
 * Visual-only legacy fields stay editor-local and never reach persistence.
 */
export function buildPublishPayload({
  post,
  blocks,
  slug,
  contentType,
  action,
  extra,
  now = new Date(),
}: {
  post: Page | Post;
  blocks: BlockConfig[];
  slug: string;
  contentType: 'page' | 'post';
  action: PublishAction;
  extra?: PublishExtra;
  now?: Date;
}): PublishPayload {
  const isPublish = action === 'publish';
  const payload: PublishPayload = {
    blocks: stripVisualContentFromBlocks(blocks),
    status: isPublish ? 'publish' : 'draft',
    publishedAt: isPublish ? now.toISOString() : null,
    slug: isPublish ? slug || generateSlug(post.title) : post.slug,
    expectedVersion: post.version ?? 0,
  };

  if (contentType === 'page' && 'siteId' in post && post.siteId) {
    payload.siteId = post.siteId;
  }
  if (extra?.title) payload.title = extra.title;
  if (extra?.other) payload.other = extra.other;

  return payload;
}
