import { Router } from 'express';
import type { Deps } from './shared/deps';
import { readErrorStatus, resolveRequestSite } from './shared/resolve-request-site';
import { assertCanChangeTheme, assertCanMakeTheme } from '../lib/access';
import { readPublicSiteIdHint, resolvePublicSite } from './shared/resolve-public-site';
import { getRequestAuthSiteId } from '../auth';
import { themeSettingsSchema, parseThemeSettings, DEFAULT_THEME_SETTINGS } from '@shared/theme-settings';
import {
  createThemeInputSchema,
  updateThemeInputSchema,
} from '@shared/theme-record';
import { isSystemDefaultTheme } from '@shared/theme-display';
import { resolveSiteThemeSettings } from './shared/resolve-site-theme-settings';
import { asyncHandler } from './shared/async-handler';

/**
 * Creates themes and hooks routes.
 * Plugin inventory lives in `plugins.routes.ts`.
 *
 * Note: This router is mounted at /api and handles:
 * - /api/themes/* - Theme management
 * - /api/hooks - Hook debugging
 */
export function createThemesRoutes(deps: Deps) {
  const router = Router();
  const { models, requireAuth, authService, hooks } = deps;

  /**
   * GET /api/themes
   * List all themes
   * Auth: Required
   */
  router.get('/themes', requireAuth, async (_req, res) => {
    try {
      const themes = await models.themes.findMany();
      res.json(themes);
    } catch (error) {
      console.error('Error fetching themes:', error);
      res.status(500).json({ message: 'Failed to fetch themes' });
    }
  });

  /**
   * GET /api/themes/active
   * The theme of the site this request is for (?siteId=, the API key's site, else the domain).
   * Each site has its own theme; there is no install-wide active theme.
   * Auth: Public (needed for rendering)
   */
  router.get('/themes/active', async (req, res) => {
    try {
      const site = await resolvePublicSite({
        models,
        req,
        siteIdHint: readPublicSiteIdHint(req) ?? getRequestAuthSiteId(req),
      });
      const theme = site?.activeThemeId ? await models.themes.findById(site.activeThemeId) : undefined;
      res.json(theme ? { ...theme, status: 'active', siteId: site?.id } : null);
    } catch (error) {
      console.error({ atFunction: 'getActiveTheme', data: { error }, message: 'Error fetching active theme' });
      res.status(500).json({ message: 'Failed to fetch active theme' });
    }
  });

  /**
   * POST /api/themes/:id/activate
   * Uses a theme on one site (the one the request names, or the API key's site). Other sites keep theirs.
   * Auth: Required
   */
  router.post('/themes/:id/activate', requireAuth, async (req, res) => {
    const userId = authService.getCurrentUserId(req);
    try {
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const site = await resolveRequestSite({ models, req, userId, need: 'manage_site' });
      const theme = await models.themes.findById(req.params.id);
      if (!theme) {
        return res.status(404).json({ message: 'Theme not found' });
      }

      await models.sites.update(site.id, { activeThemeId: theme.id, updatedAt: new Date() });
      res.json({ ...theme, status: 'active', siteId: site.id });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const status = readErrorStatus(err);
      console.error({
        atFunction: 'activateTheme',
        data: { userId, themeId: req.params.id, error: err },
        message: 'Error activating theme',
      });
      res.status(status).json({ message: status >= 500 ? 'Could not switch the theme. Try again.' : err.message });
    }
  });

  /**
   * POST /api/themes
   * Create a custom theme (inactive until activated on a site).
   */
  router.post(
    '/themes',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = authService.getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await assertCanMakeTheme({ models, userId });

      const parsed = createThemeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid theme details' });
      }

      const settings = parseThemeSettings(parsed.data.settings ?? DEFAULT_THEME_SETTINGS);

      const theme = await models.themes.create({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        authorId: userId,
        version: '1.0.0',
        requires: '1.0.0',
        status: 'inactive',
        renderer: null,
        settings,
      });

      hooks.doAction('save_theme', theme);

      res.status(201).json({
        ...theme,
        settings: parseThemeSettings(theme.settings),
      });
    }),
  );

  /**
   * GET /api/themes/:id
   */
  router.get(
    '/themes/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const theme = await models.themes.findById(req.params.id);
      if (!theme) {
        return res.status(404).json({ message: 'Theme not found' });
      }

      res.json({
        ...theme,
        settings: parseThemeSettings(theme.settings),
      });
    }),
  );

  /**
   * PATCH /api/themes/:id
   * Update theme name, description, and/or design settings.
   */
  router.patch(
    '/themes/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = authService.getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const id = req.params.id;
      const existing = await models.themes.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Theme not found' });
      }

      if (isSystemDefaultTheme(existing)) {
        return res.status(403).json({ message: 'The built-in Default theme cannot be edited' });
      }

      await assertCanChangeTheme({ models, userId, theme: existing });

      const parsed = updateThemeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid theme update' });
      }

      if (
        parsed.data.name === undefined &&
        parsed.data.description === undefined &&
        parsed.data.settings === undefined
      ) {
        return res.status(400).json({ message: 'Nothing to update' });
      }

      const theme = await models.themes.update(id, {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.settings !== undefined ? { settings: parsed.data.settings } : {}),
      });

      hooks.doAction('save_theme', theme);

      res.json({
        ...theme,
        settings: parseThemeSettings(theme?.settings),
      });
    }),
  );

  /**
   * PATCH /api/themes/:id/settings
   * Update theme design tokens (auth required).
   * @deprecated Prefer PATCH /api/themes/:id with a settings field.
   */
  router.patch(
    '/themes/:id/settings',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = authService.getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const id = req.params.id;
      const existing = await models.themes.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Theme not found' });
      }

      if (isSystemDefaultTheme(existing)) {
        return res.status(403).json({ message: 'The built-in Default theme cannot be edited' });
      }

      await assertCanChangeTheme({ models, userId, theme: existing });

      const parsedBody = themeSettingsSchema.safeParse(req.body?.settings ?? req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid theme settings' });
      }

      const theme = await models.themes.update(id, {
        settings: parsedBody.data,
      });

      hooks.doAction('save_theme_settings', theme);

      res.json({
        id: theme?.id ?? id,
        settings: parseThemeSettings(theme?.settings ?? parsedBody.data),
      });
    }),
  );

  /**
   * GET /api/public/site-theme?siteId=
   * Public design tokens for visitor rendering.
   */
  router.get(
    '/public/site-theme',
    asyncHandler(async (req, res) => {
      const siteId =
        typeof req.query.siteId === 'string' && req.query.siteId.trim()
          ? req.query.siteId.trim()
          : undefined;

      if (!siteId) {
        return res.status(400).json({ message: 'siteId is required' });
      }

      const resolved = await resolveSiteThemeSettings({ models, siteId });
      res.json({
        themeId: resolved.themeId,
        settings: resolved.settings,
      });
    }),
  );

  /**
   * GET /api/hooks
   * Debug endpoint showing all registered WordPress hooks
   * Auth: Required
   */
  router.get('/hooks', requireAuth, async (_req, res) => {
    try {
      res.json({
        actions: hooks.getActions(),
        filters: hooks.getFilters(),
      });
    } catch (error) {
      console.error('Error fetching hooks:', error);
      res.status(500).json({ message: 'Failed to fetch hooks' });
    }
  });

  return router;
}
