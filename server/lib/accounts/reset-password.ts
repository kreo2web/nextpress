import { auth } from "../better-auth";
import { models } from "../../storage";

/** Better Auth's id for the email-and-password sign-in record. */
const SIGN_IN_PROVIDER = "credential";

export type ResetPasswordRefusal = "too_short" | "too_long" | "no_account" | "not_saved";

export type ResetPasswordResult =
	| { ok: true; userId: string; email: string | null; username: string }
	| { ok: false; reason: ResetPasswordRefusal; message: string };

const refuse = (reason: ResetPasswordRefusal, message: string): ResetPasswordResult => ({ ok: false, reason, message });

/** Same rule as the login form and sign-in: an `@` means email. Both are stored lowercase. */
function findUserByLogin(login: string) {
	const normalized = login.trim().toLowerCase();
	return normalized.includes("@") ? models.users.findByEmail(normalized) : models.users.findByUsername(normalized);
}

/**
 * Gives a locked-out person a new password. Only the `reset-password` shell command calls this:
 * there is no web route, so it needs the same shell access that already reaches the database.
 * The password goes through Better Auth's own hashing and helpers, so it is saved exactly the way
 * sign-in reads it, now and after library upgrades. An account with no sign-in record (very old
 * installs) gets one. Every existing sign-in for the person ends, because a reset often follows
 * something going wrong.
 */
export async function resetPassword({ login, password }: { login: string; password: string }): Promise<ResetPasswordResult> {
	const context = await auth.$context;
	const { minPasswordLength, maxPasswordLength } = context.password.config;
	if (password.length < minPasswordLength) return refuse("too_short", `Use at least ${minPasswordLength} characters.`);
	if (password.length > maxPasswordLength) return refuse("too_long", `Use at most ${maxPasswordLength} characters.`);

	const user = await findUserByLogin(login);
	if (!user) return refuse("no_account", `No account uses "${login.trim()}". Check the email or username and try again.`);

	const hash = await context.password.hash(password);
	const accounts = await context.internalAdapter.findAccounts(user.id);
	const hadSignInRecord = accounts.some((account) => account.providerId === SIGN_IN_PROVIDER);
	if (hadSignInRecord) {
		await context.internalAdapter.updatePassword(user.id, hash);
	} else {
		await context.internalAdapter.linkAccount({ userId: user.id, providerId: SIGN_IN_PROVIDER, accountId: user.id, password: hash });
	}

	const saved = (await context.internalAdapter.findAccounts(user.id)).find((account) => account.providerId === SIGN_IN_PROVIDER);
	const isSaved = saved?.password ? await context.password.verify({ hash: saved.password, password }) : false;
	if (!isSaved) {
		console.error({
			atFunction: "resetPassword",
			data: { userId: user.id, hadSignInRecord, hasSavedPassword: Boolean(saved?.password) },
			message: "The new password did not read back from the database",
		});
		return refuse("not_saved", "The new password could not be confirmed. Run the command again.");
	}

	await context.internalAdapter.deleteUserSessions(user.id);
	return { ok: true, userId: user.id, email: user.email, username: user.username };
}
