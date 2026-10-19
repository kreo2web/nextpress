import { auth } from "../better-auth";

export type NewAccount = { name: string; email: string; username: string; password: string };

/**
 * Makes a sign-in account through Better Auth on the server, so the password lands where sign-in
 * reads it. Server calls skip the web sign-up gate: only admins and invite links reach this.
 * It gives no site role; the caller decides that.
 */
export async function createAccount(input: NewAccount): Promise<{ userId: string }> {
	const result = await auth.api.signUpEmail({ body: { ...input, firstName: input.name } });
	if (!result?.user?.id) throw new Error(`Better Auth made no account for ${input.email}`);
	return { userId: result.user.id };
}
