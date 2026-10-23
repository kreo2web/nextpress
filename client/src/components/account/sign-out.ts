import { authClient } from '@/lib/auth-client';

/**
 * Signs out and goes to the home page. Leaves even when the sign-out call fails: the person asked
 * to go, and a stale session cookie is refused by the server on the next request anyway.
 */
export const signOutAndLeave = async ({ atFunction, userId }: { atFunction: string; userId?: string }): Promise<void> => {
	try {
		await authClient.signOut();
	} catch (error) {
		console.error({ atFunction, data: { userId, error }, message: 'Sign-out failed; leaving anyway' });
	}
	window.location.href = '/';
};
