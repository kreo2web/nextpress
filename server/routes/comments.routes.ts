import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Comment } from '@shared/schema-types';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { getSitePostIds } from './shared/site-content';
import { readErrorStatus } from './shared/status-error';
import { resolveReadSiteId } from '../lib/content-access';
import { isPubliclyReadable } from '../lib/is-publicly-readable';
import { assertCanOnItem, findItemSiteId, readerCanEdit } from '../lib/access';
import { resolveRequestAuth } from '../auth';
import { createRateLimiter } from '../utils/rate-limit';
import { clientAddress } from '../utils/client-address';
import { safeTryAsync } from '../utils';

const MAX_PER_PAGE = 100;
const COMMENT_LIMIT = { limit: 5, windowMs: 60_000 };
const COMMENT_STATUSES = ['approved', 'pending', 'spam', 'trash'] as const;

/** What a visitor sees of a comment: never the commenter's email. */
type PublicComment = Omit<Comment, 'authorEmail'>;

const newCommentSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(10000),
  authorName: z.string().trim().min(1).max(120).optional(),
  authorEmail: z.string().trim().email().max(320).optional(),
  parentId: z.string().uuid().optional(),
});

const commentChangeSchema = z
  .object({
    content: z.string().trim().min(1).max(10000),
    status: z.enum(COMMENT_STATUSES),
    authorName: z.string().trim().max(120),
  })
  .partial();

const toPublicComment = ({ authorEmail: _email, ...comment }: Comment): PublicComment => comment;

/** Settings → Discussion for the comment's site. Missing values fall back to the shipped defaults (on, moderated). */
const readCommentRules = async ({ models, siteId }: { models: Deps['models']; siteId: string }): Promise<{ open: boolean; moderated: boolean }> => {
  const settings = (await models.sites.getSettings(siteId)) as { discussion?: { enableComments?: boolean; moderateComments?: boolean } } | null;
  return {
    open: settings?.discussion?.enableComments !== false,
    moderated: settings?.discussion?.moderateComments !== false,
  };
};

/**
 * Comments. Visitors post (when the site has comments on) and read approved comments without
 * emails. The site's team (editors and above) sees every comment and moderates. The server decides
 * a new comment's status and author: a visitor can't post as approved or as someone else.
 */
export function createCommentsRoutes(deps: Deps): Router {
  const router = Router();
  const { models, hooks, requireAuth } = deps;
  const checkRateLimit = createRateLimiter();

  const sendError = ({ res, error, atFunction, data }: { res: Response; error: Error; atFunction: string; data: Record<string, string> }): Response => {
    const status = readErrorStatus(error);
    if (status >= 500) console.error({ atFunction, data: { ...data, error }, message: 'Comment request failed' });
    return res.status(status).json({ message: status >= 500 ? 'Something went wrong with this comment. Try again.' : error.message });
  };

  // GET /api/comments - one site's comments; drafts of the conversation only for the site's team
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { post_id, postId, status = 'approved', page = '1', per_page = '10' } = req.query;
      const resolvedPostId = (typeof post_id === 'string' && post_id) || (typeof postId === 'string' && postId) || '';
      const requestedSiteId = typeof req.query.siteId === 'string' && req.query.siteId.trim() ? req.query.siteId.trim() : undefined;
      // One site's comments: the named site, the API key's site, or the site of this domain.
      const siteId = await resolveReadSiteId({ req, models, requestedSiteId });
      const pageNumber = Math.max(1, parseInt(String(page)) || 1);
      const limit = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(String(per_page)) || 10));
      const offset = (pageNumber - 1) * limit;
      const empty = { comments: [], total: 0, page: pageNumber, per_page: limit, total_pages: 0 };
      if (!siteId) return res.json(empty);

      const team = await readerCanEdit({ req, models, siteId });
      const wantedStatus = team ? String(status) : 'approved';
      const postIds = await getSitePostIds({ models, siteId });
      if (postIds.length === 0) return res.json(empty);

      const filters: Array<{ where: string; equals?: unknown; in?: unknown[] }> = [
        ...(resolvedPostId ? [{ where: 'postId', equals: resolvedPostId }] : []),
        ...(wantedStatus !== 'all' ? [{ where: 'status', equals: wantedStatus }] : []),
        { where: 'postId', in: postIds },
      ];
      const [comments, total] = await Promise.all([
        models.comments.findManyWhere(filters, { limit, offset }),
        models.comments.count({ where: filters }),
      ]);

      res.json({
        comments: team ? comments : comments.map(toPublicComment),
        total,
        page: pageNumber,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      });
    }),
  );

  // POST /api/comments - a visitor or signed-in person comments on a published post
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      if (!checkRateLimit({ key: `comment:${clientAddress(req)}`, ...COMMENT_LIMIT })) {
        return res.status(429).json({ message: 'You are commenting very fast. Wait a minute and try again.' });
      }
      const parsed = newCommentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Write a comment and your name, then try again.' });
      }
      const input = parsed.data;

      const { err, result } = await safeTryAsync(async () => {
        const post = await models.posts.findById(input.postId);
        const siteId = post ? await findItemSiteId({ models, kind: 'post', id: post.id }) : null;
        if (!post || !siteId || !isPubliclyReadable(post)) return { status: 404 as const, message: 'This post is not available.' };

        const rules = await readCommentRules({ models, siteId });
        if (!rules.open) return { status: 403 as const, message: 'Comments are closed on this site.' };
        if (post.allowComments === false) return { status: 403 as const, message: 'Comments are closed on this post.' };

        if (input.parentId) {
          const parent = await models.comments.findById(input.parentId);
          if (!parent || parent.postId !== post.id) return { status: 400 as const, message: 'The comment you replied to is gone.' };
        }

        const auth = await resolveRequestAuth(req);
        const author = auth?.method === 'session' ? await models.users.findById(auth.userId) : undefined;
        const authorName = author?.name ?? author?.username ?? input.authorName;
        if (!authorName) return { status: 400 as const, message: 'Add your name, then try again.' };

        const comment = await models.comments.create({
          postId: post.id,
          content: input.content,
          status: rules.moderated ? 'pending' : 'approved',
          authorName,
          ...(author ? { authorId: author.id, authorEmail: author.email ?? undefined } : {}),
          ...(!author && input.authorEmail ? { authorEmail: input.authorEmail } : {}),
          ...(input.parentId ? { parentId: input.parentId } : {}),
        });
        hooks.doAction('new_comment', comment);
        return { status: 201 as const, comment };
      });
      if (err || !result) return sendError({ res, error: err ?? new Error('no result'), atFunction: 'comments.create', data: { postId: input.postId } });
      if (result.status !== 201) return res.status(result.status).json({ message: result.message });
      res.status(201).json(toPublicComment(result.comment));
    }),
  );

  /** Runs a moderation step on one comment after checking the person moderates that comment's site. */
  const moderate = ({ atFunction, run }: { atFunction: string; run: (params: { id: string; req: Request }) => Promise<Comment | { message: string }> }) =>
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id;
      const { err, result } = await safeTryAsync(async () => {
        await assertCanOnItem({ req, models, kind: 'comment', id, action: 'moderate_comments' });
        return run({ id, req });
      });
      if (err || !result) return sendError({ res, error: err ?? new Error('no result'), atFunction, data: { commentId: id } });
      res.json(result);
    });

  router.get('/:id', requireAuth, moderate({
    atFunction: 'comments.get',
    run: async ({ id }) => (await models.comments.findById(id)) as Comment,
  }));

  router.put('/:id', requireAuth, moderate({
    atFunction: 'comments.update',
    run: async ({ id, req }) => {
      const change = commentChangeSchema.safeParse(req.body ?? {});
      if (!change.success) throw Object.assign(new Error('Some details were not valid. Check them and try again.'), { statusCode: 400 });
      const updated = await models.comments.update(id, { ...change.data, updatedAt: new Date() });
      hooks.doAction('edit_comment', updated);
      return updated;
    },
  }));

  router.delete('/:id', requireAuth, moderate({
    atFunction: 'comments.delete',
    run: async ({ id }) => {
      await models.comments.delete(id);
      hooks.doAction('delete_comment', id);
      return { message: 'Comment deleted successfully' };
    },
  }));

  router.patch('/:id/approve', requireAuth, moderate({
    atFunction: 'comments.approve',
    run: async ({ id }) => {
      const comment = await models.comments.approve(id);
      hooks.doAction('approve_comment', comment);
      return comment;
    },
  }));

  router.patch('/:id/spam', requireAuth, moderate({
    atFunction: 'comments.spam',
    run: async ({ id }) => {
      const comment = await models.comments.spam(id);
      hooks.doAction('spam_comment', comment);
      return comment;
    },
  }));

  return router;
}
