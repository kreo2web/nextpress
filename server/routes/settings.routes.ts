import { Router } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { safeTryAsync } from '../utils';
import { partialSettingsSchema } from '@shared/settings-schema';
import { readErrorStatus, resolveRequestSite } from './shared/resolve-request-site';
import { changeSiteAddress } from '../lib/site-address';

/**
 * Creates settings routes for site-wide configuration management
 * 
 * Endpoints:
 * - GET /api/settings - Get current site settings
 * - PATCH /api/settings - Update site settings (partial)
 * 
 * All endpoints require authentication.
 * Settings are stored in sites.settings jsonb column.
 * 
 * @param deps - Injected dependencies (models, auth)
 * @returns Express router with mounted settings routes
 */
export function createSettingsRoutes(deps: Deps): Router {
  const router = Router();
  const { models, requireAuth, authService } = deps;

  /**
   * GET /api/settings
   * Get current site settings merged with defaults
   * Auth: Required
   */
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = authService.getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { err, result } = await safeTryAsync(async () => {
        const site = await resolveRequestSite({ models, req, userId });
        const settings = await models.sites.getSettings(site.id);
        return { status: true, data: settings, siteId: site.id };
      });

      if (err) {
        console.error('Error fetching settings:', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch settings';
        const status = readErrorStatus(err);
        return res.status(status).json({
          status: false,
          message,
        });
      }

      res.json(result);
    })
  );

  /**
   * PATCH /api/settings
   * Update site settings with partial changes
   * Auth: Required
   * 
   * Validates partial payload, merges with existing, persists
   */
  router.patch(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      // Log incoming payload for debugging
      console.log('PATCH /api/settings - Received payload:', JSON.stringify(req.body, null, 2));

      const userId = authService.getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Validate partial payload first (before safeTryAsync)
      const validationResult = partialSettingsSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        console.log('Validation failed:', validationResult.error.errors);
        return res.status(400).json({
          status: false,
          message: 'Invalid settings data',
          errors: validationResult.error.errors,
        });
      }

      const { err, result } = await safeTryAsync(async () => {
        const site = await resolveRequestSite({ models, req, userId, need: 'manage_site' });

        // The address goes through the one path that also checks it and updates the web server.
        const addressInput = validationResult.data.general?.siteUrl;
        let notice: string | null = null;
        if (addressInput !== undefined) {
          const addressChange = await changeSiteAddress({ models, userId, siteId: site.id, input: addressInput });
          if (!addressChange.ok) {
            return { status: false, message: addressChange.message, statusCode: addressChange.statusCode };
          }
          notice = addressChange.notice;
        }

        await models.sites.updateSettings(validationResult.data, site.id);
        const updatedSettings = await models.sites.getSettings(site.id);

        return { status: true, data: updatedSettings, siteId: site.id, notice };
      });

      if (err) {
        console.error('Error updating settings:', err);
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        const status = readErrorStatus(err);
        return res.status(status).json({
          status: false,
          message,
        });
      }

      // Address problems (bad address, used by another site, DNS not ready) come back as { status: false }
      if (result && !result.status) {
        const { statusCode, ...body } = result;
        return res.status(statusCode ?? 400).json(body);
      }

      res.json(result);
    })
  );

  return router;
}
