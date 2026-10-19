import { randomBytes } from "node:crypto";
import { isAtLeast, isSiteRoleName, type SiteRoleName, type SiteStanding } from "@shared/access";
import {
	INVITE_MESSAGES,
	invitePath,
	placesLeft,
	readInviteState,
	type CreateInviteInput,
	type InviteSummary,
	type InviteView,
	type JoinInput,
	type JoinResult,
} from "@shared/invites";
import type { Invite } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { statusError } from "../../routes/shared/status-error";
import { readSiteAccess, readSiteStanding } from "../access/site-standing";
import type { NewAccount } from "../accounts/create-account";

type InviteModels = Pick<Deps["models"], "invites" | "roles" | "userRoles" | "sites" | "users">;

/** 24 characters from 18 random bytes: long enough that links can't be guessed. */
const newCode = (): string => randomBytes(18).toString("base64url");

const DAY_MS = 24 * 60 * 60 * 1000;

const toIso = (value: Date | string | null): string | null => (value ? new Date(value).toISOString() : null);

export type InviteService = ReturnType<typeof createInviteService>;

/**
 * Invite links: an admin shares a link that gives one role on one site, to a set number of people
 * or anyone with it, until it ends or is cancelled. A link never gives more than its maker has.
 */
export function createInviteService({
	models,
	createAccount,
}: {
	models: InviteModels;
	createAccount: (input: NewAccount) => Promise<{ userId: string }>;
}) {
	const roleNameOf = async (roleId: string): Promise<SiteRoleName> => {
		const role = await models.roles.findById(roleId);
		if (!role || !isSiteRoleName(role.name)) throw new Error(`Invite points at role ${roleId}, which is not a site role`);
		return role.name;
	};

	const toSummary = async (invite: Invite): Promise<InviteSummary> => ({
		id: invite.id,
		siteId: invite.siteId,
		role: await roleNameOf(invite.roleId),
		code: invite.code,
		path: invitePath(invite.code),
		note: invite.note ?? null,
		maxUses: invite.maxUses ?? null,
		uses: invite.uses,
		placesLeft: placesLeft({ maxUses: invite.maxUses ?? null, uses: invite.uses }),
		expiresAt: toIso(invite.expiresAt),
		state: readInviteState({ cancelledAt: invite.cancelledAt, expiresAt: invite.expiresAt, maxUses: invite.maxUses ?? null, uses: invite.uses }),
		createdAt: toIso(invite.createdAt),
	});

	const findOpenOrExplain = async (code: string): Promise<Invite> => {
		const invite = await models.invites.findByCode(code);
		if (!invite) throw statusError({ message: INVITE_MESSAGES.notFound, statusCode: 404 });
		const state = readInviteState({ cancelledAt: invite.cancelledAt, expiresAt: invite.expiresAt, maxUses: invite.maxUses ?? null, uses: invite.uses });
		if (state !== "open") throw statusError({ message: INVITE_MESSAGES.closed[state], statusCode: 410 });
		return invite;
	};

	/** Claims a place, runs `work`, and gives the place back if `work` fails. */
	const withPlace = async <T>({ code, work }: { code: string; work: (invite: Invite) => Promise<T> }): Promise<T> => {
		const claimed = await models.invites.claimPlace(code);
		if (!claimed) {
			await findOpenOrExplain(code);
			throw statusError({ message: INVITE_MESSAGES.closed.full, statusCode: 410 });
		}
		try {
			return await work(claimed);
		} catch (error) {
			await models.invites.givePlaceBack(claimed.id);
			throw error;
		}
	};

	const giveRole = async ({ userId, invite, role }: { userId: string; invite: Invite; role: SiteRoleName }): Promise<void> => {
		const roleRow = await models.roles.findByName(role);
		if (!roleRow) throw new Error(`Role ${role} is missing, so invite ${invite.id} could not be used`);
		await models.userRoles.assignRole(userId, roleRow.id, invite.siteId);
	};

	return {
		async list({ siteId }: { siteId: string }): Promise<InviteSummary[]> {
			return Promise.all((await models.invites.findBySite(siteId)).map(toSummary));
		},

		/** The maker must already have checked `manage_people` on the site; this keeps the role at or below theirs. */
		async create({ userId, input }: { userId: string; input: CreateInviteInput }): Promise<InviteSummary> {
			const access = await readSiteAccess({ models, userId, siteId: input.siteId });
			const makerStanding: SiteStanding | null = access.isMainSiteAdmin ? "owner" : access.standing;
			if (!isAtLeast({ a: makerStanding, b: input.role })) {
				throw statusError({ message: INVITE_MESSAGES.roleTooHigh, statusCode: 403 });
			}
			const role = await models.roles.findByName(input.role);
			if (!role) throw new Error(`Role ${input.role} is missing`);

			const invite = await models.invites.create({
				siteId: input.siteId,
				roleId: role.id,
				code: newCode(),
				note: input.note?.trim() || null,
				maxUses: input.maxUses,
				expiresAt: input.expiresInDays === null ? null : new Date(Date.now() + input.expiresInDays * DAY_MS),
				createdBy: userId,
			});
			return toSummary(invite);
		},

		/** Returns the cancelled link, or null when it isn't on this site. */
		async cancel({ siteId, inviteId }: { siteId: string; inviteId: string }): Promise<InviteSummary | null> {
			const invite = await models.invites.findById(inviteId);
			if (!invite || invite.siteId !== siteId) return null;
			const cancelled = invite.cancelledAt ? invite : await models.invites.update(inviteId, { cancelledAt: new Date() });
			return toSummary(cancelled);
		},

		/** The siteId an invite belongs to, so a route can check the person runs that site. */
		async siteOf(inviteId: string): Promise<string | null> {
			return (await models.invites.findById(inviteId))?.siteId ?? null;
		},

		async view({ code }: { code: string }): Promise<InviteView> {
			const invite = await models.invites.findByCode(code);
			if (!invite) throw statusError({ message: INVITE_MESSAGES.notFound, statusCode: 404 });
			const site = await models.sites.findById(invite.siteId);
			return {
				siteName: site?.name ?? "this site",
				role: await roleNameOf(invite.roleId),
				state: readInviteState({ cancelledAt: invite.cancelledAt, expiresAt: invite.expiresAt, maxUses: invite.maxUses ?? null, uses: invite.uses }),
				placesLeft: placesLeft({ maxUses: invite.maxUses ?? null, uses: invite.uses }),
				expiresAt: toIso(invite.expiresAt),
			};
		},

		/** A signed-in person joins. Someone who already has this role or a stronger one keeps it and uses no place. */
		async joinAsSignedIn({ code, userId }: { code: string; userId: string }): Promise<JoinResult> {
			const invite = await findOpenOrExplain(code);
			const role = await roleNameOf(invite.roleId);
			const current = await readSiteStanding({ models, userId, siteId: invite.siteId });
			if (isAtLeast({ a: current, b: role })) return { siteId: invite.siteId, role, createdAccount: false };

			await withPlace({ code, work: async (claimed) => giveRole({ userId, invite: claimed, role }) });
			return { siteId: invite.siteId, role, createdAccount: false };
		},

		/** Someone new joins: their account is made only after a place is safely theirs. */
		async joinWithNewAccount({ code, input }: { code: string; input: JoinInput }): Promise<JoinResult> {
			const invite = await findOpenOrExplain(code);
			const role = await roleNameOf(invite.roleId);
			if (await models.users.findByEmail(input.email)) throw statusError({ message: INVITE_MESSAGES.emailTaken, statusCode: 409 });
			if (await models.users.findByUsername(input.username)) throw statusError({ message: INVITE_MESSAGES.usernameTaken, statusCode: 409 });

			await withPlace({
				code,
				work: async (claimed) => {
					const { userId } = await createAccount(input);
					await giveRole({ userId, invite: claimed, role });
				},
			});
			return { siteId: invite.siteId, role, createdAccount: true };
		},
	};
}
