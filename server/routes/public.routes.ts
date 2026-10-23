import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { safeTryAsync } from '../utils';
import { enrichPostForApi, takePageAfterCategoryFilter } from '@shared/posts/post-other';
import { attachPostAuthor } from '../lib/attach-post-author';
import { isPubliclyReadable } from '../lib/is-publicly-readable';
import { allowsVisitorAccounts, findSignUpSite } from '../lib/accounts/visitor-sign-up';
import { resolvePublicSite, readPublicSiteIdHint } from './shared/resolve-public-site';
import { getSiteBlogIds } from './shared/site-content';
import {
  DEFAULT_POST_LIST_SORT,
  POST_LIST_SORT_FIELDS,
  parseContentListSort,
  toModelOrderBy,
} from '@shared/content-list-query';
import type { Filter } from '@shared/create-models';
import { bindPostBlocks } from '@shared/bind-post-blocks';
import { bindablePostFromRecord } from '@shared/bind-post-blocks';
import { renderBlocksToHtml } from '../../renderer/to-html';
import { sanitizeHtml } from '@shared/sanitize-html';
import type { BlockConfig, Site } from '@shared/schema-types';
import { publicSiteDescription, publicSiteName } from '@shared/published-document-meta';
import { resolvePageTemplateParts } from '../lib/template-parts';
import { createSiteSearch } from '../lib/site-search/site-search';
import { findPageByPath } from '../lib/page-paths/page-paths';
import { createRateLimiter } from '../utils/rate-limit';
import { clientAddress } from '../utils/client-address';

const SEARCH_MAX_QUERY_LENGTH = 100;
const SEARCH_MAX_RESULTS = 20;
const SEARCH_DEFAULT_RESULTS = 8;
/** A person typing sends a search every few keystrokes; this is far above that and far below a script. */
const SEARCH_REQUESTS_PER_MINUTE = 60;

/**
 * Public API routes — resolve site from Host header or ?siteId= hint.
 */
export function createPublicRoutes(deps: Deps): Router {
  const router = Router();
  const { models } = deps;
  const siteSearch = createSiteSearch({ models });
  const checkSearchRate = createRateLimiter();

  const siteIdentity = async (site: Site) => {
    const stored = await models.sites.getSettings(site.id);
    const url = stored.general.siteUrl || site.siteUrl || '';
    return {
      name: publicSiteName({
        settingsName: stored.general.siteName,
        recordName: site.name,
        siteUrl: url,
      }),
      description: publicSiteDescription(stored.general.siteDescription),
      url,
      discourageIndexing: Boolean(stored.reading.discourageSearchIndexing),
      descriptionFrom: stored.reading.descriptionFrom,
      logoUrl: site.logoUrl || "",
    };
  };

  router.get(
    '/page/*',
    asyncHandler(async (req, res) => {
      const { err } = await safeTryAsync(async () => {
        const site = await resolvePublicSite({
          models,
          req,
          siteIdHint: readPublicSiteIdHint(req),
        });
        if (!site) {
          res.status(404).json({ message: 'Site not found' });
          return;
        }

        // One word (`install`) or a full address (`guides/install`).
        const found = await findPageByPath({ models, siteId: site.id, path: req.params[0] ?? '' });
        const page = found?.page;
        if (!found || !page || !isPubliclyReadable(page)) {
          res.status(404).json({ message: 'Page not found' });
          return;
        }

        const parts = await resolvePageTemplateParts({
          models,
          siteId: site.id,
          pageId: page.id,
          blocks: (Array.isArray(page.blocks) ? page.blocks : []) as BlockConfig[],
        });
        res.json({ ...page, path: found.path, blocks: parts.blocks, site: await siteIdentity(site) });
      });

      if (err) {
        console.error('Error fetching published page:', err);
        res.status(500).json({ message: 'Failed to fetch page' });
      }
    }),
  );

  router.get(
    '/posts',
    asyncHandler(async (req, res) => {
      const { err } = await safeTryAsync(async () => {
        const site = await resolvePublicSite({
          models,
          req,
          siteIdHint: readPublicSiteIdHint(req),
        });
        if (!site) {
          res.status(404).json({ message: 'Site not found' });
          return;
        }

        const blogIds = await getSiteBlogIds({ models, siteId: site.id });
        if (blogIds.length === 0) {
          res.json({ posts: [], total: 0, page: 1, per_page: 12, total_pages: 0 });
          return;
        }

        const requestedBlog =
          typeof req.query.blogId === 'string' && req.query.blogId.trim()
            ? req.query.blogId.trim()
            : '';
        const scopedBlogIds = requestedBlog
          ? blogIds.includes(requestedBlog)
            ? [requestedBlog]
            : []
          : blogIds;
        if (scopedBlogIds.length === 0) {
          res.json({ posts: [], total: 0, page: 1, per_page: 12, total_pages: 0 });
          return;
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const perPage = Math.min(50, Math.max(1, Number(req.query.per_page) || 12));
        const category = typeof req.query.category === 'string' ? req.query.category : '';
        const listSort = parseContentListSort({
          sort: req.query.sort,
          order: req.query.order,
          allowedFields: POST_LIST_SORT_FIELDS,
          defaults: DEFAULT_POST_LIST_SORT,
        });
        const filters: Filter[] = [
          { where: 'status', equals: 'publish' },
          { where: 'blogId', in: scopedBlogIds },
        ];
        const fetchWide = Boolean(category.trim());
        const posts = await models.posts.findManyWhere(filters, {
          limit: fetchWide ? 500 : perPage,
          offset: fetchWide ? 0 : (page - 1) * perPage,
          orderBy: toModelOrderBy(listSort),
        });
        const mapped = [];
        // Password-protected posts never show to visitors.
        for (const post of posts.filter((row) => isPubliclyReadable(row))) {
          mapped.push(await attachPostAuthor({ models, post: enrichPostForApi(post) }));
        }
        const paged = fetchWide
          ? takePageAfterCategoryFilter({ posts: mapped, category, page, perPage })
          : { posts: mapped, total: await models.posts.count({ where: filters }) };
        res.json({
          posts: paged.posts,
          total: paged.total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(paged.total / perPage) || 0,
        });
      });

      if (err) {
        console.error('Error listing published posts:', err);
        res.status(500).json({ message: 'Failed to list posts' });
      }
    }),
  );

  router.get(
    '/post/:slug',
    asyncHandler(async (req, res) => {
      const { err } = await safeTryAsync(async () => {
        const site = await resolvePublicSite({ models, req, siteIdHint: readPublicSiteIdHint(req) });
        if (!site) {
          res.status(404).json({ message: 'Site not found' });
          return;
        }

        const blogIds = await getSiteBlogIds({ models, siteId: site.id });
        if (blogIds.length === 0) {
          res.status(404).json({ message: 'Post not found' });
          return;
        }

        const posts = await models.posts.findManyWhere([
          { where: 'slug', equals: req.params.slug },
          { where: 'blogId', in: blogIds },
        ]);

        const post = posts[0];
        if (!post || !isPubliclyReadable(post)) {
          res.status(404).json({ message: 'Post not found' });
          return;
        }

        const payload = await attachPostAuthor({ models, post: enrichPostForApi(post) });
        const parts = await resolvePageTemplateParts({
          models,
          siteId: site.id,
          pageId: post.id,
          blocks: (Array.isArray(post.blocks) ? post.blocks : []) as BlockConfig[],
        });
        const boundBlocks = bindPostBlocks({
          blocks: parts.blocks,
          post: bindablePostFromRecord(payload),
        });
        res.json({
          ...payload,
          blocks: parts.blocks,
          site: await siteIdentity(site),
          renderedHtml:
            boundBlocks.length > 0
              ? sanitizeHtml(renderBlocksToHtml(boundBlocks))
              : '',
        });
      });

      if (err) {
        console.error('Error fetching published post:', err);
        res.status(500).json({ message: 'Failed to fetch post' });
      }
    }),
  );

  router.get(
    '/homepage',
    asyncHandler(async (req, res) => {
      const { err } = await safeTryAsync(async () => {
        const site = await resolvePublicSite({ models, req, siteIdHint: readPublicSiteIdHint(req) });
        if (!site) {
          res.status(404).json({ message: 'Site not found' });
          return;
        }

        const homepage = await models.options.getOption('homepage_page_slug', site.id);
        if (!homepage?.value) {
          res.status(404).json({ message: 'No homepage has been configured' });
          return;
        }

        const page = await models.pages.findBySiteAndSlug(site.id, homepage.value);
        if (!page || !isPubliclyReadable(page)) {
          res.status(404).json({ message: 'No homepage content found' });
          return;
        }

        const parts = await resolvePageTemplateParts({
          models,
          siteId: site.id,
          pageId: page.id,
          blocks: (Array.isArray(page.blocks) ? page.blocks : []) as BlockConfig[],
        });
        res.json({ ...page, blocks: parts.blocks, site: await siteIdentity(site) });
      });

      if (err) {
        console.error('Error fetching homepage:', err);
        res.status(500).json({ message: 'Failed to fetch homepage' });
      }
    }),
  );

  /**
   * GET /api/public/search?q=&limit= — search the published pages of the site this address belongs
   * to. Answers `{ results: [{ title, path, snippet }] }`; a path ends in `#section` when the words
   * were found under a heading. Open to visitors, so it is limited per address.
   */
  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const address = clientAddress(req);
      if (!checkSearchRate({ key: `search:${address}`, limit: SEARCH_REQUESTS_PER_MINUTE, windowMs: 60_000 })) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ message: 'Too many searches in a row. Wait a moment and try again.' });
      }
      const query = (typeof req.query.q === 'string' ? req.query.q : '').trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
      if (!query) return res.json({ results: [] });
      const requested = Number(req.query.limit);
      const limit = Number.isFinite(requested) && requested >= 1 ? Math.min(SEARCH_MAX_RESULTS, Math.floor(requested)) : SEARCH_DEFAULT_RESULTS;

      const { err, result } = await safeTryAsync(async () => {
        const site = await resolvePublicSite({ models, req, siteIdHint: readPublicSiteIdHint(req) });
        return site ? { siteId: site.id, results: await siteSearch.search({ siteId: site.id, query, limit }) } : null;
      });
      if (err) {
        console.error({ atFunction: 'public.search', data: { query, host: req.get('host') ?? null, error: err }, message: 'Site search failed' });
        return res.status(500).json({ message: "Search isn't working right now. Try again in a moment." });
      }
      if (!result) return res.json({ results: [] });
      res.json({ results: result.results });
    }),
  );

  /**
   * GET /api/public/sign-up-status — whether the site this address belongs to lets visitors make an
   * account (commenters only). The sign-up page asks first, so a closed site shows the invite message.
   */
  router.get(
    '/sign-up-status',
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const site = await findSignUpSite({ models, host: req.get('host') });
        if (!site) return { open: false, siteName: null };
        return { open: await allowsVisitorAccounts({ models, siteId: site.id }), siteName: site.name ?? null };
      });
      if (err || !result) {
        console.error({ atFunction: 'public.signUpStatus', data: { host: req.get('host') ?? null, error: err }, message: 'Could not read whether sign-up is open' });
        return res.status(500).json({ message: "We couldn't check this right now. Try again in a moment." });
      }
      res.json(result);
    }),
  );

  return router;
}
