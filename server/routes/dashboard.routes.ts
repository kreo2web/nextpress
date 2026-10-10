import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { readErrorStatus, resolveRequestSite } from './shared/resolve-request-site';
import { getSiteBlogIds, getSitePostIds } from './shared/site-content';

/**
 * Dashboard routes — stats scoped to active site when siteId is provided.
 */
export function createDashboardRoutes(deps: Deps) {
  const router = Router();
  const { models, requireAuth, authService } = deps;

  router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
    try {
      const userId = authService.getCurrentUserId(req);
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const site = await resolveRequestSite({ models, req, userId });

      const blogIds = await getSiteBlogIds({ models, siteId: site.id });
      const postIds = blogIds.length > 0 ? await getSitePostIds({ models, siteId: site.id }) : [];
      const postFilters = [
        { where: 'status', equals: 'publish' },
        ...(blogIds.length > 0 ? [{ where: 'blogId', in: blogIds }] : [{ where: 'blogId', equals: '__none__' }]),
      ];

      const [postsCount, pagesCount, commentsCount, usersCount] = await Promise.all([
        blogIds.length > 0
          ? models.posts.count({ where: postFilters })
          : Promise.resolve(0),
        models.pages.count({
          where: [
            { where: 'status', equals: 'publish' },
            { where: 'siteId', equals: site.id },
          ],
        }),
        // Only this site's comments (it used to count every site's).
        postIds.length > 0
          ? models.comments.count({
              where: [
                { where: 'status', equals: 'approved' },
                { where: 'postId', in: postIds },
              ],
            })
          : Promise.resolve(0),
        models.users.count({}),
      ]);

      res.json({
        posts: postsCount,
        pages: pagesCount,
        comments: commentsCount,
        users: usersCount,
        siteId: site.id,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      const err = error instanceof Error ? error : new Error('Failed to fetch dashboard stats');
      const status = readErrorStatus(err);
      res.status(status).json({ message: status >= 500 ? 'Failed to fetch dashboard stats' : err.message });
    }
  }));

  return router;
}
