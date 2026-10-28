import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { initDevDatabase } from "../db";
import { auth } from "../lib/better-auth";
import { createAccount, resetPassword } from "../lib/accounts";
import { models } from "../storage";

/**
 * The real composed flow: accounts made and signed in through Better Auth on the in-memory test
 * database with the app's migrations, reset through `resetPassword`, then signed in again.
 */

const OLD_PASSWORD = "old-password-1";
const NEW_PASSWORD = "new-password-1";

/** Unique per test, so no test depends on another's rows. */
function newPerson(): { name: string; email: string; username: string } {
	const id = randomUUID().slice(0, 8);
	return { name: `Person ${id}`, email: `person-${id}@example.com`, username: `person${id}` };
}

async function makeAccount(): Promise<{ userId: string; email: string; username: string }> {
	const person = newPerson();
	const { userId } = await createAccount({ ...person, password: OLD_PASSWORD });
	return { userId, email: person.email, username: person.username };
}

const signIn = (email: string, password: string) => auth.api.signInEmail({ body: { email, password } });

async function countSessions(userId: string): Promise<number> {
	const context = await auth.$context;
	return (await context.internalAdapter.listSessions(userId)).length;
}

describe("resetPassword", () => {
	beforeAll(async () => {
		await initDevDatabase();
	});

	it("lets the new password sign in, refuses the old one and ends existing sign-ins", async () => {
		const { userId, email } = await makeAccount();
		await signIn(email, OLD_PASSWORD);
		expect(await countSessions(userId)).toBeGreaterThan(0);

		const result = await resetPassword({ login: email, password: NEW_PASSWORD });

		expect(result).toEqual({ ok: true, userId, email, username: expect.any(String) });
		expect(await countSessions(userId)).toBe(0);
		await expect(signIn(email, OLD_PASSWORD)).rejects.toThrow();
		const signedIn = await signIn(email, NEW_PASSWORD);
		expect(signedIn.user.id).toBe(userId);
	});

	it("finds the account by username, ignoring letter case and spaces", async () => {
		const { userId, username } = await makeAccount();

		const result = await resetPassword({ login: `  ${username.toUpperCase()} `, password: NEW_PASSWORD });

		expect(result.ok && result.userId).toBe(userId);
		const signedIn = await auth.api.signInUsername({ body: { username, password: NEW_PASSWORD } });
		expect(signedIn?.user.id).toBe(userId);
	});

	it("changes nothing when no account uses the login", async () => {
		const { email } = await makeAccount();

		const result = await resetPassword({ login: "nobody-here@example.com", password: NEW_PASSWORD });

		expect(result).toMatchObject({ ok: false, reason: "no_account" });
		await expect(signIn(email, OLD_PASSWORD)).resolves.toBeTruthy();
	});

	it("refuses a short password before changing anything", async () => {
		const { userId, email } = await makeAccount();
		await signIn(email, OLD_PASSWORD);
		const sessionsBefore = await countSessions(userId);

		const result = await resetPassword({ login: email, password: "short" });

		expect(result).toMatchObject({ ok: false, reason: "too_short" });
		expect(await countSessions(userId)).toBe(sessionsBefore);
		await expect(signIn(email, OLD_PASSWORD)).resolves.toBeTruthy();
	});

	it("gives an account with no sign-in record one, so it can sign in", async () => {
		const person = newPerson();
		const user = await models.users.create(person);
		const context = await auth.$context;
		expect(await context.internalAdapter.findAccounts(user.id)).toHaveLength(0);

		const result = await resetPassword({ login: person.email, password: NEW_PASSWORD });

		expect(result.ok).toBe(true);
		expect(await context.internalAdapter.findAccounts(user.id)).toHaveLength(1);
		const signedIn = await signIn(person.email, NEW_PASSWORD);
		expect(signedIn.user.id).toBe(user.id);
	});
});
