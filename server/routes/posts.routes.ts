import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { safeTryAsync } from '../utils';
import { coerceDates } from './shared/date-coerce';
import { enrichPostForApi, takePageAfterCategoryFilter } from '@shared/posts/post-other';
import type { Filter } from '@shared/create-models';
import { attachPostAuthor } from '../lib/attach-post-author';
import { loadAdjacentPosts } from '../lib/load-adjacent-posts';
import { getSiteBlogIds } from './shared/site-content';
import { assertCanOnItem } from '../lib/access';
import { readErrorStatus } from './shared/status-error';
import {
  assertAuthenticatedSiteAccess,
  ContentAccessError,
  ensureNonPublicContentAccess,
  listQueryRequiresAuth,
  resolveContentSiteId,
  resolveNonPublicListSiteId,
  resolveReadSiteId,
} from '../lib/content-access';
import { validateContentForSave } from '@shared/validate-content-save';
import {
  VERSION_REQUIRED,
  VERSION_STALE,
  checkExpectedVersion,
  parseExpectedVersion,
  stripVersionControlFields,
} from '@shared/content-version';
import {
  DEFAULT_POST_LIST_SORT,
  POST_LIST_SORT_FIELDS,
  parseContentListSearch,
  parseContentListSort,
  toModelOrderBy,
} from '@shared/content-list-query';
import { buildTitleSearchFilters } from '../lib/content-list-filters';
import { z } from 'zod';
import { forgetDocumentChats } from '../lib/assistant-chats';

/**
 * Creates Posts CRUD routes for the NextPress API.
 * 
 * Endpoints:
 * - GET /api/posts - List posts with pagination and status filter
 * - GET /api/posts/:id - Get single post by ID
 * - POST /api/posts - Create new post (requires auth)
 * - PUT /api/posts/:id - Update post (requires auth)
 * - DELETE /api/posts/:id - Delete post (requires auth)
 * 
 * @param deps - Injected dependencies (models, hooks, schemas, auth, etc.)
 * @returns Express router with mounted post routes
 */
export function createPostsRoutes(deps: Deps): Router {
  const router = Router();
  const { models, hooks, authService, requireAuth, CONFIG, parsePaginationParams, parseStatusParam, schemas } = deps;
  const postSchemas = schemas.posts;

  /**
   * GET /api/posts - List posts with pagination, status and blog_id filter
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const rawStatus = typeof req.query.status === 'string' ? req.query.status : CONFIG.STATUS.PUBLISH;
        const { status = CONFIG.STATUS.PUBLISH, blog_id } = req.query;
        const requestedSiteId =
          typeof req.query.siteId === 'string' && req.query.siteId.trim()
            ? req.query.siteId.trim()
            : undefined;
        const siteId = listQueryRequiresAuth(rawStatus)
          ? await resolveNonPublicListSiteId({
              req,
              models,
              requestedSiteId,
            })
          : await resolveReadSiteId({ req, models, requestedSiteId });
        if (!siteId) {
          return { posts: [], total: 0, page: 1, per_page: 0, total_pages: 0 };
        }

        const { page, limit, offset } = parsePaginationParams(
          req.query,
          CONFIG.PAGINATION.DEFAULT_POSTS_PER_PAGE
        );

        // Handle 'any' status to show all posts (for admin interface)
        const actualStatus = parseStatusParam(status as string);

        const filters: Filter[] = [];
        if (actualStatus) {
          filters.push({ where: 'status', equals: actualStatus });
        }
        if (blog_id && typeof blog_id === 'string') {
          if (siteId) {
            const siteBlogIds = await getSiteBlogIds({ models, siteId });
            if (!siteBlogIds.includes(blog_id)) {
              throw new ContentAccessError('This blog cannot be accessed on this site');
            }
          }
          filters.push({ where: 'blogId', equals: blog_id });
        } else if (siteId) {
          const blogIds = await getSiteBlogIds({ models, siteId });
          if (blogIds.length === 0) {
            return {
              posts: [],
              total: 0,
              page,
              per_page: limit,
              total_pages: 0,
            };
          }
          filters.push({ where: 'blogId', in: blogIds });
        }

        const listSort = parseContentListSort({
          sort: req.query.sort,
          order: req.query.order,
          allowedFields: POST_LIST_SORT_FIELDS,
          defaults: DEFAULT_POST_LIST_SORT,
        });
        const search = parseContentListSearch(req.query.search);
        filters.push(...buildTitleSearchFilters({ search }));
        const category = typeof req.query.category === 'string' ? req.query.category : '';
        const fetchWide = Boolean(category.trim());

        const posts = filters.length > 0
          ? await models.posts.findManyWhere(filters, {
              limit: fetchWide ? 500 : limit,
              offset: fetchWide ? 0 : offset,
              orderBy: toModelOrderBy(listSort),
            })
          : await models.posts.findMany({
              limit: fetchWide ? 500 : limit,
              offset: fetchWide ? 0 : offset,
              orderBy: toModelOrderBy(listSort),
            });

        const enriched = posts.map(enrichPostForApi);
        const paged = fetchWide
          ? takePageAfterCategoryFilter({ posts: enriched, category, page, perPage: limit })
          : {
              posts: enriched,
              total: await models.posts.count({
                where: filters.length > 0 ? filters : undefined,
              }),
            };

        return {
          posts: paged.posts,
          total: paged.total,
          page,
          per_page: limit,
          total_pages: Math.ceil(paged.total / limit),
        };
      });

      if (err) {
        console.error('Error fetching posts:', err);
        const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
        if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
          return res.status(statusCode).json({ message: err.message });
        }
        return res.status(500).json({ message: 'Failed to fetch posts' });
      }

      res.json(result);
    })
  );

  const postReorderSchema = z.object({
    siteId: z.string().uuid(),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          menuOrder: z.number().int().min(0),
        }),
      )
      .min(1)
      .max(100),
  });

  /**
   * PATCH /api/posts/reorder - Batch update manual list order for posts on a site
   */
  router.patch(
    '/reorder',
    requireAuth,
    asyncHandler(async (req, res) => {
      const parsed = postReorderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid reorder payload' });
      }

      await assertAuthenticatedSiteAccess({
        req,
        models,
        siteId: parsed.data.siteId,
      });

      const siteBlogIds = await getSiteBlogIds({ models, siteId: parsed.data.siteId });

      // Check every post first, so a refused list changes nothing.
      const existing = await Promise.all(parsed.data.items.map((item) => models.posts.findById(item.id)));
      if (existing.some((post) => !post?.blogId || !siteBlogIds.includes(post.blogId))) {
        return res.status(403).json({ message: 'One or more posts are not accessible on this site' });
      }
      for (const item of parsed.data.items) {
        await models.posts.update(item.id, { menuOrder: item.menuOrder });
      }

      res.json({ ok: true, updated: parsed.data.items.length });
    }),
  );

  /**
   * GET /api/posts/:id/adjacent - Previous and next posts in the same blog.
   */
  router.get(
    '/:id/adjacent',
    asyncHandler(async (req, res) => {
      const post = await models.posts.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const siteId = await resolveContentSiteId({
        models,
        contentType: 'post',
        contentId: post.id,
      });
      if (siteId) {
        const allowed = await ensureNonPublicContentAccess({
          req,
          res,
          models,
          siteId,
          status: post.status,
          password: post.password,
        });
        if (!allowed) {
          return;
        }
      } else if (post.status !== 'publish') {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!post.blogId) {
        return res.json({ prev: null, next: null });
      }

      const adjacent = await loadAdjacentPosts({
        post,
        findSiblings: (blogId) =>
          models.posts.findManyWhere([{ where: 'blogId', equals: blogId }], {
            limit: 200,
            orderBy: { property: 'createdAt', order: 'ascending' },
          }),
      });
      res.json(adjacent);
    }),
  );

  /**
   * GET /api/posts/:id - Get single post by ID
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      try {
        const post = await models.posts.findById(req.params.id);
        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }

        const siteId = await resolveContentSiteId({
          models,
          contentType: 'post',
          contentId: post.id,
        });

        if (siteId) {
          const allowed = await ensureNonPublicContentAccess({
            req,
            res,
            models,
            siteId,
            status: post.status,
            password: post.password,
          });
          if (!allowed) {
            return;
          }
        } else if (post.status !== 'publish') {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        res.json(await attachPostAuthor({ models, post: enrichPostForApi(post) }));
      } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ message: 'Failed to fetch post' });
      }
    })
  );

  /**
   * POST /api/posts - Create new post (requires authentication)
   */
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const userId = authService.getCurrentUserId(req);
        if (!userId) {
          throw new Error('User not authenticated');
        }

        // Validate title before parse so we can generate slug
        const title = req.body.title;
        if (!title || typeof title !== 'string') {
          throw new Error('Title is required and must be a string');
        }

        // Generate slug before validation so the required field is present
        const titleStr = String(title);
        const slugValue = req.body.slug 
          ? String(req.body.slug)
          : titleStr
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

        // A post lives in a blog, and a blog on a site: the person must be able to edit that site.
        const blogId = typeof req.body.blogId === 'string' ? req.body.blogId : '';
        if (!blogId) {
          throw Object.assign(new Error('Pick a blog for this post.'), { statusCode: 400 });
        }
        await assertCanOnItem({ req, models, kind: 'blog', id: blogId });

        // Include authorId and slug in the data before validation
        const parsedData = postSchemas.insert.parse({
          ...coerceDates(req.body as Record<string, unknown>, ['publishedAt']),
          slug: slugValue,
          authorId: userId,
        });

        const contentValidation = validateContentForSave({
          blocks: parsedData.blocks,
          contentType: 'post',
        });
        if (!contentValidation.ok) {
          return res.status(400).json({
            code: contentValidation.error.code,
            message: contentValidation.error.message,
          });
        }
        
        const postData = {
          ...parsedData,
          title: String(parsedData.title),
          slug: String(parsedData.slug),
          authorId: String(parsedData.authorId),
          blocks: contentValidation.blocks,
        };

        const post = await models.posts.create(postData);
        hooks.doAction('save_post', post);

        if (post.status === CONFIG.STATUS.PUBLISH) {
          hooks.doAction('publish_post', post);
        }

        return post;
      });

      if (err) {
        const status = readErrorStatus(err);
        if (status >= 500) console.error({ atFunction: 'posts.create', data: { blogId: req.body?.blogId, error: err }, message: 'Failed to create post' });
        return res.status(status).json({ message: status >= 500 ? 'Failed to create post' : err.message });
      }

      res.status(201).json(result);
    })
  );

  /**
   * PUT /api/posts/:id - Update existing post (requires authentication)
   */
  router.put(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      try {
        const id = req.params.id;
        const versionParsed = parseExpectedVersion(req.body);
        if (!versionParsed.ok) {
          return res.status(400).json({
            code: VERSION_REQUIRED,
            message: 'expectedVersion is required and must be a non-negative integer',
          });
        }
        const { expectedVersion } = versionParsed;

        const existingPost = await models.posts.findById(id);
        if (!existingPost) {
          return res.status(404).json({ message: 'Post not found' });
        }

        const remoteVersion = (existingPost as { version?: number }).version ?? 0;
        const versionConflict = checkExpectedVersion({ remoteVersion, expectedVersion });
        if (!versionConflict.ok) {
          return res.status(409).json({
            code: VERSION_STALE,
            message: `Remote version ${versionConflict.remoteVersion} does not match expected ${versionConflict.expectedVersion}. Fetch latest and retry.`,
            remoteVersion: versionConflict.remoteVersion,
            expectedVersion: versionConflict.expectedVersion,
          });
        }

        const postData = postSchemas.update.parse(
          coerceDates(stripVersionControlFields(req.body as Record<string, unknown>), ['publishedAt']),
        );

        if (postData.blocks !== undefined) {
          const contentValidation = validateContentForSave({
            blocks: postData.blocks,
            contentType: 'post',
          });
          if (!contentValidation.ok) {
            return res.status(400).json({
              code: contentValidation.error.code,
              message: contentValidation.error.message,
            });
          }
          postData.blocks = contentValidation.blocks;
        }

        const { err: accessErr } = await safeTryAsync(async () => {
          const { siteId } = await assertCanOnItem({ req, models, kind: 'post', id });
          // Moving to another blog stays on the same site.
          const targetBlogId = (postData as { blogId?: string | null }).blogId;
          if (targetBlogId && targetBlogId !== existingPost.blogId) {
            const target = await assertCanOnItem({ req, models, kind: 'blog', id: targetBlogId });
            if (target.siteId !== siteId) {
              throw Object.assign(new Error('A post can only move to a blog on the same site.'), { statusCode: 400 });
            }
          }
        });
        if (accessErr) {
          return res.status(readErrorStatus(accessErr)).json({ message: accessErr.message });
        }

        const wasPublished = existingPost.status === 'publish';
        const post = await models.posts.update(id, {
          ...postData,
          version: expectedVersion + 1,
        });

        hooks.doAction('save_post', post);

        if (!wasPublished && post.status === 'publish') {
          hooks.doAction('publish_post', post);
        }

        res.json(post);
      } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ message: 'Failed to update post' });
      }
    })
  );

  /**
   * DELETE /api/posts/:id - Delete post (requires authentication)
   */
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      try {
        const id = req.params.id;
        const post = await models.posts.findById(id);

        if (!post) {
          return res.status(404).json({ message: 'Post not found' });
        }

        const { err: accessErr } = await safeTryAsync(() => assertCanOnItem({ req, models, kind: 'post', id }));
        if (accessErr) {
          return res.status(readErrorStatus(accessErr)).json({ message: accessErr.message });
        }

        await models.posts.delete(id);
        hooks.doAction('delete_post', id);
        await forgetDocumentChats({ models, documentKind: 'post', documentId: id });

        res.json({ message: 'Post deleted successfully' });
      } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Failed to delete post' });
      }
    })
  );

  return router;
}
