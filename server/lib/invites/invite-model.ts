import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { invites } from "@shared/schema";
import type { Invite } from "@shared/schema-types";
import { createModel, type DatabaseInstance } from "@shared/create-models";

/** Links a site shows on its People screen; old cancelled or used-up ones stay listed for a while. */
const SITE_LIST_LIMIT = 200;

export function createInviteModel(dbInstance: DatabaseInstance) {
	const baseModel = createModel(invites, dbInstance);
	return {
		...baseModel,

		async findByCode(code: string): Promise<Invite | undefined> {
			return baseModel.findFirst([{ where: "code", equals: code }]);
		},

		async findBySite(siteId: string): Promise<Invite[]> {
			return baseModel.findManyWhere([{ where: "siteId", equals: siteId }], {
				limit: SITE_LIST_LIMIT,
				orderBy: { property: "createdAt", order: "descending" },
			});
		},

		/**
		 * Takes one place on a link that is still open, or returns null when it isn't (cancelled,
		 * ended, or full). It is one UPDATE with the checks in its WHERE, so two people opening the
		 * link at once can never both take its last place.
		 */
		async claimPlace(code: string): Promise<Invite | null> {
			const rows: Invite[] = await dbInstance
				.update(invites)
				.set({ uses: sql`${invites.uses} + 1` })
				.where(
					and(
						eq(invites.code, code),
						isNull(invites.cancelledAt),
						or(isNull(invites.maxUses), lt(invites.uses, invites.maxUses)),
						or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
					),
				)
				.returning();
			return rows[0] ?? null;
		},

		/** Gives a claimed place back when the account behind it could not be made. */
		async givePlaceBack(id: string): Promise<void> {
			await dbInstance
				.update(invites)
				.set({ uses: sql`GREATEST(${invites.uses} - 1, 0)` })
				.where(eq(invites.id, id));
		},
	};
}

export type InviteModel = ReturnType<typeof createInviteModel>;
