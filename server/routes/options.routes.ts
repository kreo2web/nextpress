import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { readErrorStatus, resolveRequestSite } from './shared/resolve-request-site';
import { resolvePublicSite, readPublicSiteIdHint } from './shared/resolve-public-site';
import { isReservedOptionName } from '../lib/ai-builder/reserved-option-names';
import { readerCanEdit } from '../lib/access';

/** The options a published site reads; everything else (plugin and API values) is for the site's team. */
const PUBLIC_OPTION_NAMES = new Set(['homepage_page_slug', 'site_title']);

/**
 * Creates options routes (WordPress-compatible settings API).
 * Options are scoped per site via siteId query/body param.
 */
export function createOptionsRoutes(deps: Deps) {
  const router = Router();
  const { models, requireAuth, authService } = deps;

  /**
   * GET /api/options/:name?siteId=
   * Get option value by name for a site. Reserved names (AI settings) are never returned.
   */
  router.get('/:name', asyncHandler(async (req, res) => {
    try {
      // Reserved names answer like a missing option: this route needs no sign-in.
      if (isReservedOptionName(req.params.name)) {
        return res.status(404).json({ message: 'Option not found' });
      }

      const site = await resolvePublicSite({
        models,
        req,
        siteIdHint: readPublicSiteIdHint(req),
      });
      if (!site) {
        return res.status(404).json({ message: 'Site not found' });
      }

      // A missing option and one a visitor may not read answer the same.
      if (!PUBLIC_OPTION_NAMES.has(req.params.name) && !(await readerCanEdit({ req, models, siteId: site.id }))) {
        return res.status(404).json({ message: 'Option not found' });
      }

      const option = await models.options.getOption(req.params.name, site.id);
      if (!option) {
        return res.status(404).json({ message: 'Option not found' });
      }
      res.json(option);
    } catch (error) {
      console.error('Error fetching option:', error);
      res.status(500).json({ message: 'Failed to fetch option' });
    }
  }));

  /**
   * POST /api/options
   * Set or update option value for a site. Reserved names (AI settings) are refused.
   */
  router.post('/', requireAuth, asyncHandler(async (req, res) => {
    try {
      const userId = authService.getCurrentUserId(req);
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const { name, value } = req.body ?? {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'name is required' });
      }
      if (isReservedOptionName(name)) {
        return res.status(400).json({ message: 'That option name is reserved. Use a different name.' });
      }
      if (value === undefined || value === null) {
        return res.status(400).json({ message: 'value is required' });
      }

      const site = await resolveRequestSite({ models, req, userId, need: 'manage_site' });

      const option = await models.options.setOption({
        name,
        value: String(value),
        siteId: site.id,
      });
      res.json(option);
    } catch (error) {
      console.error('Error setting option:', error);
      const err = error instanceof Error ? error : new Error('Failed to set option');
      const status = readErrorStatus(err);
      res.status(status).json({ message: status >= 500 ? 'Failed to set option' : err.message });
    }
  }));

  return router;
}
