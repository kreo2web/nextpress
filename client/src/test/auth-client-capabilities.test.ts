import { describe, expect, it } from 'vitest';
import { authClient } from '@/lib/auth-client';

/**
 * The browser client builds its methods from the server's endpoints. A missing endpoint would
 * only show up when a person tries to change their password, so it is checked here.
 */
describe('browser auth client', () => {
	it('can change a password', () => {
		expect(typeof authClient.changePassword).toBe('function');
	});

	it('can sign in, sign out and read the session', () => {
		expect(typeof authClient.signIn.email).toBe('function');
		expect(typeof authClient.signIn.username).toBe('function');
		expect(typeof authClient.signOut).toBe('function');
		expect(typeof authClient.getSession).toBe('function');
	});
});
