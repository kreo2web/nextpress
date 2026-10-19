import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ACCESS_MESSAGES, isSiteRoleName } from '@shared/access';
import { userOtherWithBio } from '@shared/author-display';
import type { User } from '@shared/schema-types';
import type { Deps } from './shared/deps';
import { asyncHandler } from './shared/async-handler';
import { readErrorStatus } from './shared/status-error';
import { safeTryAsync } from '../utils';
import { assertMainSiteAdmin, isMainSiteAdmin, listWorkableSites } from '../lib/access';

/** Fields anyone working on a site may read about a person: what an author box shows. */
type PublicProfile = Pick<User, 'id' | 'name' | 'username' | 'displayUsername' | 'firstName' | 'lastName' | 'profileImageUrl'> & {
  other: { bio?: string };
};

/** A person as admins (and the person themselves) see them. The unused legacy password column never leaves. */
type UserRecord = Omit<User, 'password'>;

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    firstName: z.string().trim().max(120).nullable(),
    lastName: z.string().trim().max(120).nullable(),
    displayUsername: z.string().trim().max(120).nullable(),
    profileImageUrl: z.string().trim().max(2048).nullable(),
    bio: z.string().max(5000),
    /** The author box sends its whole `other`; only `bio` is taken from it. */
    other: z.object({ bio: z.string().max(5000).optional() }).passthrough(),
  })
  .partial();

const adminFieldsSchema = z
  .object({
    email: z.string().trim().email().max(320),
    username: z.string().trim().min(2).max(60),
    status: z.enum(['active', 'inactive']),
  })
  .partial();

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(320),
  username: z.string().trim().min(2).max(60),
  password: z.string().min(8).max(200),
  /** Optional: give the new person a role on one site straight away. */
  siteId: z.string().uuid().optional(),
  role: z.string().optional(),
});

export type CreateAccount = (input: { name: string; email: string; username: string; password: string }) => Promise<{ userId: string }>;

const toRecord = (user: User): UserRecord => {
  const { password: _password, ...record } = user;
  return record;
};

const toPublicProfile = (user: User): PublicProfile => {
  const other = user.other && typeof user.other === 'object' ? (user.other as { bio?: unknown }) : {};
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    displayUsername: user.displayUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    other: typeof other.bio === 'string' ? { bio: other.bio } : {},
  };
};

/** A database "still referenced" refusal: the person still owns content. */
const isStillReferenced = (error: Error | null): boolean =>
  (error as { code?: string; cause?: { code?: string } } | null)?.code === '23503' ||
  (error as { cause?: { code?: string } } | null)?.cause?.code === '23503';

/**
 * People. Everyone signed in may read an author's public profile (if they work on a site) and edit
 * their own profile. Listing, adding, changing someone else's account and removing people is for
 * main-site admins, because a person belongs to the whole install, not one site.
 * Who may do what on one site lives in the People screen (site roles and invite links).
 */
export function createUsersRoutes(deps: Deps, { createAccount }: { createAccount?: CreateAccount } = {}): Router {
  const router = Router();
  const { models } = deps;

  const signedIn = (req: Request, res: Response): string | null => {
    const userId = deps.authService.getCurrentUserId(req);
    if (!userId) res.status(401).json({ message: ACCESS_MESSAGES.signIn });
    return userId ?? null;
  };

  const sendError = ({ res, error, atFunction, data, fallback }: {
    res: Response;
    error: Error;
    atFunction: string;
    data: Record<string, string | undefined>;
    fallback: string;
  }): Response => {
    const status = readErrorStatus(error);
    if (status >= 500) console.error({ atFunction, data: { ...data, error }, message: fallback });
    return res.status(status).json({ message: status >= 500 ? fallback : error.message });
  };

  router.get('/', deps.requireAuth, asyncHandler(async (req, res) => {
    const userId = signedIn(req, res);
    if (!userId) return;
    const { page, limit, offset } = deps.parsePaginationParams(req.query, deps.CONFIG.PAGINATION.DEFAULT_PAGE_SIZE);

    const { err, result } = await safeTryAsync(async () => {
      await assertMainSiteAdmin({ models, userId });
      const [users, total] = await Promise.all([models.users.findMany({ limit, offset }), models.users.count({})]);
      return { users: users.map(toRecord), total };
    });
    if (err || !result) {
      return sendError({ res, error: err ?? new Error('no result'), atFunction: 'users.list', data: { userId }, fallback: 'Could not load people. Try again.' });
    }

    res.json({ users: result.users, total: result.total, page, per_page: limit, total_pages: Math.ceil(result.total / limit) });
  }));

  router.get('/:id', deps.requireAuth, asyncHandler(async (req, res) => {
    const userId = signedIn(req, res);
    if (!userId) return;
    const targetId = req.params.id;

    const { err, result } = await safeTryAsync(async () => {
      const user = await models.users.findById(targetId);
      if (!user) return { status: 404 as const };
      if (user.id === userId || (await isMainSiteAdmin({ models, userId }))) return { status: 200 as const, body: toRecord(user) };
      const sites = await listWorkableSites({ models, userId });
      return sites.length > 0 ? { status: 200 as const, body: toPublicProfile(user) } : { status: 404 as const };
    });
    if (err || !result) {
      return sendError({ res, error: err ?? new Error('no result'), atFunction: 'users.get', data: { userId, targetId }, fallback: 'Could not load this person. Try again.' });
    }
    if (result.status === 404) return res.status(404).json({ message: ACCESS_MESSAGES.notFound });
    res.json(result.body);
  }));

  router.post('/', deps.requireAuth, asyncHandler(async (req, res) => {
    const userId = signedIn(req, res);
    if (!userId) return;
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Enter a name, a valid email, a username and a password of at least 8 characters.' });
    }
    if (!createAccount) {
      return res.status(503).json({ message: 'Adding people directly is not available here. Use an invite link.' });
    }
    const input = parsed.data;

    const { err, result } = await safeTryAsync(async () => {
      await assertMainSiteAdmin({ models, userId });
      if (input.role !== undefined && (!input.siteId || !isSiteRoleName(input.role))) return { status: 400 as const, message: 'Pick a site and a role.' };
      if (input.siteId && !(await models.sites.findById(input.siteId))) return { status: 400 as const, message: 'That site no longer exists.' };
      const role = input.role ? await models.roles.findByName(input.role) : undefined;

      if (await models.users.findByEmail(input.email)) return { status: 409 as const, message: 'Someone already uses this email.' };
      if (await models.users.findByUsername(input.username)) return { status: 409 as const, message: 'Someone already uses this username.' };

      const { userId: createdId } = await createAccount({ name: input.name ?? input.username, email: input.email, username: input.username, password: input.password });
      if (input.siteId && role) await models.userRoles.assignRole(createdId, role.id, input.siteId);
      const created = await models.users.findById(createdId);
      return { status: 201 as const, body: created ? toRecord(created) : { id: createdId } };
    });
    if (err || !result) {
      return sendError({ res, error: err ?? new Error('no result'), atFunction: 'users.create', data: { userId, email: input.email }, fallback: 'Could not add this person. Try again.' });
    }
    if (result.status !== 201) return res.status(result.status).json({ message: result.message });
    res.status(201).json(result.body);
  }));

  router.put('/:id', deps.requireAuth, asyncHandler(async (req, res) => {
    const userId = signedIn(req, res);
    if (!userId) return;
    const targetId = req.params.id;
    const profile = profileSchema.safeParse(req.body ?? {});
    const adminFields = adminFieldsSchema.safeParse(req.body ?? {});
    if (!profile.success || !adminFields.success) {
      return res.status(400).json({ message: 'Some details were not valid. Check them and try again.' });
    }

    const { err, result } = await safeTryAsync(async () => {
      const user = await models.users.findById(targetId);
      if (!user) return { status: 404 as const };
      const isSelf = user.id === userId;
      const mainAdmin = await isMainSiteAdmin({ models, userId });
      if (!isSelf && !mainAdmin) return { status: 404 as const };

      const wantsAdminFields = Object.keys(adminFields.data).length > 0;
      if (wantsAdminFields && !mainAdmin) return { status: 403 as const, message: ACCESS_MESSAGES.mainSiteOnly };
      if (adminFields.data.email && adminFields.data.email !== user.email && (await models.users.findByEmail(adminFields.data.email))) {
        return { status: 409 as const, message: 'Someone already uses this email.' };
      }
      if (adminFields.data.username && adminFields.data.username !== user.username && (await models.users.findByUsername(adminFields.data.username))) {
        return { status: 409 as const, message: 'Someone already uses this username.' };
      }

      const { bio, other, ...profileFields } = profile.data;
      const nextBio = bio ?? other?.bio;
      const updated = await models.users.update(targetId, {
        ...profileFields,
        ...adminFields.data,
        ...(nextBio !== undefined ? { other: userOtherWithBio({ other: user.other, bio: nextBio }) } : {}),
        updatedAt: new Date(),
      });
      return { status: 200 as const, body: toRecord(updated) };
    });
    if (err || !result) {
      return sendError({ res, error: err ?? new Error('no result'), atFunction: 'users.update', data: { userId, targetId }, fallback: 'Could not save these details. Try again.' });
    }
    if (result.status === 404) return res.status(404).json({ message: ACCESS_MESSAGES.notFound });
    if (result.status !== 200) return res.status(result.status).json({ message: result.message });
    res.json(result.body);
  }));

  router.delete('/:id', deps.requireAuth, asyncHandler(async (req, res) => {
    const userId = signedIn(req, res);
    if (!userId) return;
    const targetId = req.params.id;
    if (targetId === userId) return res.status(400).json({ message: "You can't remove your own account." });

    const { err, result } = await safeTryAsync(async () => {
      await assertMainSiteAdmin({ models, userId });
      if (!(await models.users.findById(targetId))) return { status: 404 as const };
      if ((await models.sites.findByOwner(targetId)).length > 0) {
        return { status: 409 as const, message: 'This person owns a site. Give the site to someone else first.' };
      }
      await models.users.deleteWithRoles(targetId);
      return { status: 200 as const };
    });
    if (isStillReferenced(err)) {
      console.warn({ atFunction: 'users.delete', data: { userId, targetId, error: err }, message: 'Refused: this person still owns content' });
      return res.status(409).json({ message: 'This person still has pages, posts or other content, so they can’t be removed. Take away their roles instead.' });
    }
    if (err || !result) {
      return sendError({ res, error: err ?? new Error('no result'), atFunction: 'users.delete', data: { userId, targetId }, fallback: 'Could not remove this person. Try again.' });
    }
    if (result.status === 404) return res.status(404).json({ message: ACCESS_MESSAGES.notFound });
    if (result.status === 409) return res.status(409).json({ message: result.message });
    res.json({ message: 'Removed.' });
  }));

  return router;
}
