import type { AssistantChatDocumentKind } from "@shared/assistant-chats";
import type { Deps } from "../../routes/shared/deps";
import type { AssistantChatRecord, AssistantChatStore } from "../../lib/assistant-chats";

/**
 * A made-up install for the saved-chat tests: no database, only in-memory stand-ins for the few models the
 * access rules read. A call to anything a stand-in doesn't provide throws, so a test never passes by
 * accident on a method nobody wrote.
 */
export const WORLD = {
	siteA: "b0000000-0000-4000-8000-00000000000a",
	siteB: "b0000000-0000-4000-8000-00000000000b",
	ownerA: "a0000000-0000-4000-8000-0000000000a1",
	ownerB: "a0000000-0000-4000-8000-0000000000b1",
	alice: "a0000000-0000-4000-8000-000000000001", // editor on site A
	bob: "a0000000-0000-4000-8000-000000000002", // editor on site A
	carol: "a0000000-0000-4000-8000-000000000003", // editor on site B only
	dave: "a0000000-0000-4000-8000-000000000004", // subscriber on site A: no assistant
	erin: "a0000000-0000-4000-8000-000000000005", // no role anywhere
	editorRole: "c0000000-0000-4000-8000-000000000002",
	subscriberRole: "c0000000-0000-4000-8000-000000000003",
	pageA: "e0000000-0000-4000-8000-0000000000a1",
	pageA2: "e0000000-0000-4000-8000-0000000000a2",
	pageB: "e0000000-0000-4000-8000-0000000000b1",
	blogA: "d0000000-0000-4000-8000-0000000000a1",
	postA: "f0000000-0000-4000-8000-0000000000a1",
	missingPage: "e0000000-0000-4000-8000-0000000000ff",
} as const;

export const fakeModel = <Model extends object>(name: string, implemented: Partial<Model>): Model =>
	new Proxy(implemented as Model, {
		get: (target, key) => {
			if (typeof key === "symbol" || key === "then") return undefined;
			if (key in target) return target[key as keyof Model];
			return () => {
				throw new Error(`The ${name} stand-in has no "${key}". Add it only if the code under test needs it.`);
			};
		},
	});

type Assignment = { userId: string; roleId: string; siteId: string };
type RoleFilter = { where: string; in?: string[]; equals?: string };

export type World = {
	models: Pick<Deps["models"], "sites" | "roles" | "userRoles" | "pages" | "posts" | "blogs">;
	/** Change who holds which role while a test runs. */
	assignments: Assignment[];
};

export const createWorld = (): World => {
	const siteOwners: Record<string, string> = { [WORLD.siteA]: WORLD.ownerA, [WORLD.siteB]: WORLD.ownerB };
	const roleNames: Record<string, string> = { [WORLD.editorRole]: "editor", [WORLD.subscriberRole]: "subscriber" };
	const assignments: Assignment[] = [
		{ userId: WORLD.alice, roleId: WORLD.editorRole, siteId: WORLD.siteA },
		{ userId: WORLD.bob, roleId: WORLD.editorRole, siteId: WORLD.siteA },
		{ userId: WORLD.carol, roleId: WORLD.editorRole, siteId: WORLD.siteB },
		{ userId: WORLD.dave, roleId: WORLD.subscriberRole, siteId: WORLD.siteA },
	];
	const pageSites: Record<string, string> = { [WORLD.pageA]: WORLD.siteA, [WORLD.pageA2]: WORLD.siteA, [WORLD.pageB]: WORLD.siteB };

	const models: World["models"] = {
		sites: fakeModel<Deps["models"]["sites"]>("sites", {
			findById: async (id) => (siteOwners[id] ? ({ id, ownerId: siteOwners[id] } as Awaited<ReturnType<Deps["models"]["sites"]["findById"]>>) : undefined),
			findDefaultSite: async () => ({ id: WORLD.siteA, ownerId: WORLD.ownerA }) as Awaited<ReturnType<Deps["models"]["sites"]["findDefaultSite"]>>,
		}),
		userRoles: fakeModel<Deps["models"]["userRoles"]>("userRoles", {
			findByUser: async (userId) => assignments.filter((entry) => entry.userId === userId) as Awaited<ReturnType<Deps["models"]["userRoles"]["findByUser"]>>,
		}),
		roles: fakeModel<Deps["models"]["roles"]>("roles", {
			findManyWhere: async (filters) => {
				const [filter] = filters as RoleFilter[];
				const wanted = filter?.in ?? [];
				return Object.entries(roleNames)
					.filter(([id, name]) => (filter?.equals ? name === filter.equals : wanted.includes(id)))
					.map(([id, name]) => ({ id, name })) as Awaited<ReturnType<Deps["models"]["roles"]["findManyWhere"]>>;
			},
		}),
		pages: fakeModel<Deps["models"]["pages"]>("pages", {
			findById: async (id) => (pageSites[id] ? ({ id, siteId: pageSites[id] } as Awaited<ReturnType<Deps["models"]["pages"]["findById"]>>) : undefined),
		}),
		posts: fakeModel<Deps["models"]["posts"]>("posts", {
			findById: async (id) => (id === WORLD.postA ? ({ id, blogId: WORLD.blogA } as Awaited<ReturnType<Deps["models"]["posts"]["findById"]>>) : undefined),
		}),
		blogs: fakeModel<Deps["models"]["blogs"]>("blogs", {
			findById: async (id) => (id === WORLD.blogA ? ({ id, siteId: WORLD.siteA } as Awaited<ReturnType<Deps["models"]["blogs"]["findById"]>>) : undefined),
		}),
	};
	return { models, assignments };
};

export type MemoryChatStore = AssistantChatStore & { rows: AssistantChatRecord[] };

/**
 * The same promises as the database model, kept in a list: every call tied to a person, a save over someone
 * else's id (or another page's) changes nothing and answers nothing, newest first. The real statements
 * are checked in assistant-chat-model.test.ts.
 */
export const createMemoryChatStore = (): MemoryChatStore => {
	const rows: AssistantChatRecord[] = [];
	const sameDocument = (row: AssistantChatRecord, kind: AssistantChatDocumentKind, id: string): boolean =>
		row.documentKind === kind && row.documentId === id;

	return {
		rows,
		async findOwned({ id, userId }) {
			const row = rows.find((entry) => entry.id === id && entry.userId === userId);
			return row ? { ...row } : undefined;
		},
		async listSummaries({ userId, documentKind, documentId, limit }) {
			return rows
				.filter((row) => row.userId === userId && sameDocument(row, documentKind, documentId))
				.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
				.slice(0, limit)
				.map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
		},
		async saveOwned(chat) {
			const existing = rows.find((row) => row.id === chat.id);
			if (!existing) {
				const { now, ...fields } = chat;
				const created: AssistantChatRecord = { ...fields, createdAt: now, updatedAt: now };
				rows.push(created);
				return { ...created };
			}
			const isSamePlace =
				existing.userId === chat.userId && existing.siteId === chat.siteId && sameDocument(existing, chat.documentKind, chat.documentId);
			if (!isSamePlace) return undefined;
			existing.messages = chat.messages;
			existing.updatedAt = chat.now;
			return { ...existing };
		},
		async removeOwned({ id, userId }) {
			const index = rows.findIndex((row) => row.id === id && row.userId === userId);
			if (index === -1) return false;
			rows.splice(index, 1);
			return true;
		},
		async removeOwnedMany({ ids, userId }) {
			ids.forEach((id) => {
				const index = rows.findIndex((row) => row.id === id && row.userId === userId);
				if (index !== -1) rows.splice(index, 1);
			});
		},
		async removeForDocument({ documentKind, documentId }) {
			for (let index = rows.length - 1; index >= 0; index -= 1) {
				if (sameDocument(rows[index]!, documentKind, documentId)) rows.splice(index, 1);
			}
		},
	};
};
