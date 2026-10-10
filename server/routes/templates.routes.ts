import { Router, type Request, type Response } from 'express';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { safeTryAsync } from '../utils';
import { getRequestAuthSiteId } from '../auth';
import { readErrorStatus, resolveRequestSite, statusError } from './shared/resolve-request-site';
import {
  canManageTemplate,
  findTemplatePartUsage,
  listLinkedTemplateParts,
  listPreDesignedTemplates,
} from '../lib/template-parts';
import {
  buildTemplatePartMarker,
  isTemplatePart,
  TEMPLATE_PART_TYPE,
  keepTemplateUsage,
  readTemplatePartSiteId,
} from '@shared/template-usage';
import { readTemplateRoot, TEMPLATE_ROOT_MESSAGE } from '@shared/template-parts';
import type { BlockConfig } from '@shared/schema-types';

/** Stored template blocks are untyped JSON; anything that isn't a list reads as no blocks. */
const asBlockList = (blocks: unknown): BlockConfig[] => (Array.isArray(blocks) ? (blocks as BlockConfig[]) : []);

/**
 * Creates template routes. Two kinds of rows share this API (see shared/template-usage.ts):
 * pre-designed blocks, which are copied into a page, and linked template parts, which belong to
 * one site and are shown on a page through a `core/template-part` block.
 *
 * Endpoints:
 * - GET    /api/templates                 - Pre-designed blocks (?type, page, per_page).
 *                                           With ?usage=part&siteId=… the linked parts of that site, each with usedOnPages
 * - GET    /api/templates/:id             - Get one template (a linked part only for people who manage its site)
 * - GET    /api/templates/:id/usage       - Pages of the template's site that show it (linked parts only)
 * - POST   /api/templates                 - Create (auth required). With usage "part" and a siteId, creates a linked part
 * - POST   /api/templates/:id/duplicate   - Duplicate template (auth required)
 * - PUT    /api/templates/:id             - Update (auth required). The part marker cannot be changed
 * - DELETE /api/templates/:id             - Delete template (auth required)
 */
export function createTemplatesRoutes(deps: Deps): Router {
  const router = Router();
  const { models, requireAuth, authService, schemas } = deps;

  const currentUserId = (req: Request): string | null => authService.getCurrentUserId(req);

  const requireUserId = (req: Request): string => {
    const userId = currentUserId(req);
    if (!userId) throw statusError({ message: 'Sign in again to continue.', statusCode: 401 });
    return userId;
  };

  /** The template when this request may see it. Null when it does not exist or belongs to a site the request cannot reach. */
  const readManagedTemplate = async (req: Request, id: string) => {
    const template = await models.templates.findById(id);
    if (!template) return null;
    const allowed = await canManageTemplate({
      models,
      userId: currentUserId(req),
      keySiteId: getRequestAuthSiteId(req) ?? null,
      template,
    });
    return allowed ? template : null;
  };

  /** Answers a failed template request. Client mistakes keep their message; server faults are logged with their ids. */
  const sendFailure = (res: Response, err: Error, atFunction: string, ids: Record<string, unknown>, fallback: string) => {
    const statusCode = readErrorStatus(err);
    if (statusCode >= 500) console.error('[templates] Request failed', { atFunction, ...ids, error: err });
    return res.status(statusCode).json({ message: statusCode >= 500 ? fallback : err.message });
  };

  // GET /api/templates - Pre-designed blocks, or the linked parts of one site with ?usage=part
  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.per_page ?? '10'), 10) || 10));

        if (req.query.usage === undefined) {
          const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined;
          return listPreDesignedTemplates({ models, type, page, perPage });
        }
        if (req.query.usage === 'part') {
          const site = await resolveRequestSite({ models, req, userId: requireUserId(req) });
          return listLinkedTemplateParts({ models, siteId: site.id, page, perPage });
        }
        throw statusError({ message: 'Unknown template usage.', statusCode: 400 });
      });
      if (err || !result) return sendFailure(res, err ?? new Error('No result'), 'templates.list', {}, 'Failed to load templates');
      res.json(result);
    })
  );

  // GET /api/templates/:id - Get single template (auth required)
  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(() => readManagedTemplate(req, req.params.id));
      if (err) return sendFailure(res, err, 'templates.get', { templateId: req.params.id }, 'Failed to load template');
      if (!result) return res.status(404).json({ message: 'Template not found' });
      res.json(result);
    })
  );

  // GET /api/templates/:id/usage - Pages of the template's site that show a linked part
  router.get(
    '/:id/usage',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const template = await readManagedTemplate(req, req.params.id);
        if (!template) return null;
        const siteId = readTemplatePartSiteId(template.other);
        if (!siteId) return { pages: [] };
        const usage = await findTemplatePartUsage({ models, siteId });
        return { pages: usage.get(template.id) ?? [] };
      });
      if (err) return sendFailure(res, err, 'templates.usage', { templateId: req.params.id }, 'Failed to load where this template is used');
      if (!result) return res.status(404).json({ message: 'Template not found' });
      res.json(result);
    })
  );

  // POST /api/templates - Create new template (auth required, injects authorId)
  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const userId = requireUserId(req);
        // A linked part is whatever its one layout block holds, so it has no type of its own.
        const isPart = req.body?.usage === 'part';
        const parsed = schemas.templates.insert.safeParse({
          ...req.body,
          authorId: userId,
          ...(isPart ? { type: TEMPLATE_PART_TYPE } : {}),
        });
        if (!parsed.success) throw statusError({ message: 'Check the template details and try again.', statusCode: 400 });
        const parsedData = parsed.data;

        if (!parsedData.name || !parsedData.type) {
          throw statusError({ message: 'Give the template a name and a type.', statusCode: 400 });
        }

        const templateData = {
          name: String(parsedData.name),
          authorId: String(parsedData.authorId),
          type: String(parsedData.type),
          ...(parsedData.description && { description: String(parsedData.description) }),
          ...(parsedData.blocks && { blocks: parsedData.blocks }),
          ...(parsedData.settings && { settings: parsedData.settings }),
        };

        if (isPart) {
          if (!readTemplateRoot(asBlockList(parsedData.blocks))) {
            throw statusError({ message: TEMPLATE_ROOT_MESSAGE, statusCode: 400 });
          }
          const site = await resolveRequestSite({ models, req, userId });
          return models.templates.create({ ...templateData, other: buildTemplatePartMarker({ siteId: site.id }) });
        }

        return models.templates.create(templateData);
      });

      if (err || !result) return sendFailure(res, err ?? new Error('No result'), 'templates.create', {}, 'Failed to create template');
      res.status(201).json(result);
    })
  );

  // POST /api/templates/:id/duplicate - Duplicate existing template (auth required)
  router.post(
    '/:id/duplicate',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Template name is required' });
      }

      const { err, result } = await safeTryAsync(async () => {
        const template = await readManagedTemplate(req, req.params.id);
        if (!template) return null;
        return models.templates.duplicate(req.params.id, name);
      });
      if (err) return sendFailure(res, err, 'templates.duplicate', { templateId: req.params.id }, 'Failed to duplicate template');
      if (!result) return res.status(404).json({ message: 'Template not found' });
      res.status(201).json(result);
    })
  );

  // PUT /api/templates/:id - Update template (auth required)
  router.put(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const existing = await readManagedTemplate(req, req.params.id);
        if (!existing) return null;
        const parsed = schemas.templates.update.safeParse(req.body);
        if (!parsed.success) throw statusError({ message: 'Check the template details and try again.', statusCode: 400 });
        const update = parsed.data;
        // A linked part stays one layout block, so it fills one slot on every page that shows it.
        if (isTemplatePart(existing.other) && update.blocks !== undefined && !readTemplateRoot(asBlockList(update.blocks))) {
          throw statusError({ message: TEMPLATE_ROOT_MESSAGE, statusCode: 400 });
        }
        const next = update.other === undefined
          ? update
          : { ...update, other: keepTemplateUsage({ stored: existing.other, incoming: update.other }) };
        return models.templates.update(req.params.id, next);
      });
      if (err) return sendFailure(res, err, 'templates.update', { templateId: req.params.id }, 'Failed to update template');
      if (!result) return res.status(404).json({ message: 'Template not found' });
      res.json(result);
    })
  );

  // DELETE /api/templates/:id - Delete template (auth required)
  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { err, result } = await safeTryAsync(async () => {
        const template = await readManagedTemplate(req, req.params.id);
        if (!template) return false;
        await models.templates.delete(req.params.id);
        return true;
      });
      if (err) return sendFailure(res, err, 'templates.delete', { templateId: req.params.id }, 'Failed to delete template');
      if (!result) return res.status(404).json({ message: 'Template not found' });
      res.json({ message: 'Template deleted successfully' });
    })
  );

  return router;
}
