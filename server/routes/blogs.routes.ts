import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { safeTryAsync } from '../utils';
import { generateSlug } from './shared/slug';
import { readErrorStatus, resolveRequestSite } from './shared/resolve-request-site';
import { resolveReadSiteId } from '../lib/content-access';
import { assertCanOnItem, readerCanEdit } from '../lib/access';
import { resolveSiteThemeSettings } from './shared/resolve-site-theme-settings';
import { mergePageOtherWithThemeDefaults } from '@shared/theme-to-page-design';
import { scheduleSearchIndexRebuild } from '../lib/site-search';
import { readBlogHome, updateBlogHomeList } from '../lib/blog-home/blog-home';
import { uniquePageSlug } from './shared/duplicate-page';
import { DEFAULT_BLOG_HOME_LIST, readBlogHomeListPatch, type BlogHomeList } from '@shared/blog/blog-home-list';
import type { JsonValue } from '@shared/blocks/docs-types';

/**
 * Builds a PostList block config pre-configured for a specific blog.
 * This block is placed on the auto-created blog page so it lists that blog's posts.
 */
function buildBlogPostListBlock(blogId: string, list: BlogHomeList = DEFAULT_BLOG_HOME_LIST) {
  return {
    id: crypto.randomUUID(),
    name: 'post/list',
    label: 'Post List',
    type: 'block' as const,
    parentId: null,
    category: 'post' as const,
    content: {
      postsPerPage: 6,
      ...list,
      blogId,
      orderBy: 'date',
      order: 'desc',
      className: '',
    },
    styles: { padding: '20px', margin: '0px' },
    settings: {},
  };
}

/**
 * Creates Blog CRUD routes for the NextPress API.
 *
 * Endpoints:
 * - GET /api/blogs       — List blogs with pagination
 * - GET /api/blogs/:id   — Get single blog by ID
 * - POST /api/blogs      — Create new blog (requires auth)
 * - PUT /api/blogs/:id   — Update blog (requires auth)
 * - DELETE /api/blogs/:id — Delete blog (requires auth)
 *
 * @param deps - Injected dependencies (models, hooks, schemas, auth, etc.)
 * @returns Express router with mounted blog routes
 */
export function createBlogsRoutes(deps: Deps): Router {
  const router = Router();
  const { models, hooks, requireAuth, authService, CONFIG, parsePaginationParams, parseStatusParam, schemas } = deps;
  const blogSchemas = schemas.blogs;

  /**
   * GET /api/blogs — List blogs with pagination and optional status filter.
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const { page, limit, offset } = parsePaginationParams(req.query, 20);
        const { status } = req.query;
        const requestedSiteId =
          typeof req.query.siteId === 'string' && req.query.siteId.trim()
            ? req.query.siteId.trim()
            : undefined;
        // One site's blogs: the named site, the API key's site, or the site of this domain.
        const siteId = await resolveReadSiteId({ req, models, requestedSiteId });
        if (!siteId) {
          return { blogs: [], total: 0, page, per_page: limit, total_pages: 0 };
        }

        // Drafts and private blogs are for the site's own team; everyone else sees published ones.
        const canSeeAll = await readerCanEdit({ req, models, siteId });
        const actualStatus = canSeeAll ? (status ? parseStatusParam(status as string) : null) : CONFIG.STATUS.PUBLISH;

        const filters = [
          ...(actualStatus ? [{ where: 'status', equals: actualStatus }] : []),
          ...(siteId ? [{ where: 'siteId', equals: siteId }] : []),
        ];

        const blogs =
          filters.length > 0
            ? await models.blogs.findManyWhere(filters, { limit, offset })
            : await models.blogs.findMany({ limit, offset });

        const total = await models.blogs.count({
          where: filters.length > 0 ? filters : undefined,
        });

        return {
          blogs,
          total,
          page,
          per_page: limit,
          total_pages: Math.ceil(total / limit),
        };
      });

      if (err) {
        console.error('Error fetching blogs:', err);
        return res.status(500).json({ message: 'Failed to fetch blogs' });
      }

      res.json(result);
    })
  );

  /**
   * GET /api/blogs/:id — Get a single blog by ID.
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      try {
        const blog = await models.blogs.findById(req.params.id);
        const visible =
          blog && (blog.status === CONFIG.STATUS.PUBLISH || (await readerCanEdit({ req, models, siteId: String(blog.siteId) })));
        if (!blog || !visible) {
          return res.status(404).json({ message: 'Blog not found' });
        }
        res.json(blog);
      } catch (error) {
        console.error('Error fetching blog:', error);
        res.status(500).json({ message: 'Failed to fetch blog' });
      }
    })
  );

  /**
   * POST /api/blogs — Create a new blog (requires authentication).
   * Also auto-creates a corresponding page in the pages table with a
   * pre-configured PostList block, so the blog has a browsable index page.
   */
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const { authService } = deps;
        const userId = authService.getCurrentUserId(req);
        if (!userId) {
          throw new Error('User not authenticated');
        }

        const name = req.body.name;
        if (!name || typeof name !== 'string') {
          throw new Error('Blog name is required');
        }

        // Generate slug before validation so the required field is present
        const site = await resolveRequestSite({ models, req, userId });

        const slugValue = req.body.slug
          ? String(req.body.slug)
          : generateSlug(String(name));

        const parsedData = blogSchemas.insert.parse({
          ...req.body,
          slug: slugValue,
          authorId: userId,
          siteId: site.id,
        });

        const blogData = {
          ...parsedData,
          name: String(parsedData.name),
          slug: String(parsedData.slug),
          authorId: String(parsedData.authorId),
          siteId: String(parsedData.siteId),
        };

        const blog = await models.blogs.create(blogData);

        const siteId = String(site.id);

        const themeResolved = await resolveSiteThemeSettings({ models, siteId });
        const pageOther = mergePageOtherWithThemeDefaults({
          themeSettings: themeResolved.themeId ? themeResolved.settings : null,
          other: { isBlogPage: true, blogId: blog.id },
        });

        // Auto-create the blog's index page with a PostList block. The blog setup names its address
        // (`blog`), publishes it and picks how it lists posts; other callers keep the old defaults.
        const home = (req.body?.home ?? {}) as { address?: string; publish?: boolean; list?: JsonValue };
        const homeSlug = await uniquePageSlug({
          title: typeof home.address === 'string' && home.address.trim() ? home.address : `blog-${String(blog.slug)}`,
          isTaken: async (candidate) => Boolean(await models.pages.findBySiteAndSlug(siteId, candidate)),
        });
        const blogPage = await models.pages.create({
          title: String(blog.name),
          slug: homeSlug,
          siteId,
          authorId: String(userId),
          status: home.publish === true ? 'publish' : 'draft',
          blocks: [buildBlogPostListBlock(blog.id, { ...DEFAULT_BLOG_HOME_LIST, ...readBlogHomeListPatch(home.list) })],
          other: pageOther,
        } as any);

        // Link the page back to the blog
        const updatedBlog = await models.blogs.update(blog.id, {
          pageId: blogPage.id,
        } as any);

        hooks.doAction('save_blog', updatedBlog);
        scheduleSearchIndexRebuild({ models, siteId });

        return updatedBlog;
      });

      if (err) {
        console.error('Error creating blog:', err);
        const status = readErrorStatus(err);
        return res.status(status).json({ message: status >= 500 ? 'Failed to create blog' : err.message });
      }

      res.status(201).json(result);
    })
  );

  /**
   * PUT /api/blogs/:id — Update an existing blog (requires authentication).
   */
  router.put(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const { err, result } = await safeTryAsync(async () => {
        await assertCanOnItem({ req, models, kind: 'blog', id });
        // A blog stays on its site, keeps its author and its own index page.
        const { siteId: _siteId, pageId: _pageId, authorId: _authorId, ...blogData } = blogSchemas.update.parse(req.body) as Record<string, unknown>;
        const blog = await models.blogs.update(id, blogData);
        hooks.doAction('save_blog', blog);
        return blog;
      });

      if (err) {
        const status = readErrorStatus(err);
        if (status >= 500) console.error({ atFunction: 'blogs.update', data: { blogId: id, error: err }, message: 'Failed to update blog' });
        return res.status(status).json({ message: status >= 500 ? 'Failed to update blog' : err.message });
      }
      res.json(result);
    })
  );

  /**
   * GET /api/blogs/:id/home — The blog's home page: its address, whether it is live, and how it lists posts.
   */
  router.get(
    '/:id/home',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const { err, result } = await safeTryAsync(async () => {
        await assertCanOnItem({ req, models, kind: 'blog', id });
        const blog = await models.blogs.findById(id);
        return blog ? readBlogHome({ models, blog }) : null;
      });
      if (err) {
        const status = readErrorStatus(err);
        if (status >= 500) console.error({ atFunction: 'blogs.home', data: { blogId: id, error: err }, message: 'Failed to read the blog home' });
        return res.status(status).json({ message: status >= 500 ? "Couldn't read the blog's home page" : err.message });
      }
      if (!result) return res.status(404).json({ message: 'This blog has no home page.' });
      res.json(result);
    }),
  );

  /**
   * PUT /api/blogs/:id/home/list — Changes how the blog's home page lists posts (layout and what each post shows).
   */
  router.put(
    '/:id/home/list',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const { err, result } = await safeTryAsync(async () => {
        await assertCanOnItem({ req, models, kind: 'blog', id });
        const blog = await models.blogs.findById(id);
        return blog ? updateBlogHomeList({ models, hooks, blog, list: readBlogHomeListPatch(req.body as JsonValue) }) : null;
      });
      if (err) {
        const status = readErrorStatus(err);
        if (status >= 500) console.error({ atFunction: 'blogs.homeList', data: { blogId: id, error: err }, message: 'Failed to change the blog home list' });
        return res.status(status).json({ message: status >= 500 ? "Couldn't change how the blog lists posts" : err.message });
      }
      if (!result) return res.status(404).json({ message: 'This blog has no home page.' });
      res.json(result);
    }),
  );

  /**
   * DELETE /api/blogs/:id — Delete a blog and its associated page (requires authentication).
   */
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      try {
        const id = req.params.id;
        const { err: accessErr } = await safeTryAsync(() => assertCanOnItem({ req, models, kind: 'blog', id }));
        if (accessErr) {
          return res.status(readErrorStatus(accessErr)).json({ message: accessErr.message });
        }
        const blog = await models.blogs.findById(id);

        if (!blog) {
          return res.status(404).json({ message: 'Blog not found' });
        }

        const pageId = (blog as { pageId?: string | null }).pageId;

        // Posts point at their blog; removing it would orphan them, so the person moves or deletes them first.
        const postCount = await models.posts.count({ where: [{ where: 'blogId', equals: id }] });
        if (postCount > 0) {
          return res.status(409).json({ message: `This blog still has ${postCount} post${postCount === 1 ? '' : 's'}. Move or delete them first, then delete the blog.` });
        }

        // Delete blog first — blogs.page_id references pages, so the page cannot be removed while the blog exists.
        await models.blogs.delete(id);
        hooks.doAction('delete_blog', id);

        if (pageId) {
          const { err: pageErr } = await safeTryAsync(async () => {
            // Only the blog's own index page on the same site; a tampered link never reaches another site.
            const page = await models.pages.findById(pageId);
            if (page && String(page.siteId) === String(blog.siteId)) {
              await models.pages.delete(pageId);
              scheduleSearchIndexRebuild({ models, siteId: String(page.siteId) });
            }
          });
          if (pageErr) {
            console.warn({ atFunction: 'blogs.delete', data: { blogId: id, pageId, error: pageErr }, message: 'The blog was deleted but its page could not be' });
          }
        }

        res.json({ message: 'Blog deleted successfully' });
      } catch (error) {
        console.error({ atFunction: 'blogs.delete', data: { blogId: req.params.id, error }, message: 'Failed to delete blog' });
        res.status(500).json({ message: 'Failed to delete blog' });
      }
    })
  );

  return router;
}
