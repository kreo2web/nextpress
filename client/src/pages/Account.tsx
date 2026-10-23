import type { JSX } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AccountPanel } from '@/components/account/account-panel';

/** The signed-in person's own account page. Open to everyone who can sign in, whatever they may manage. */
export default function Account(): JSX.Element {
	return (
		<AdminLayout title="Your account">
			<div className="mx-auto w-full max-w-3xl">
				<AccountPanel />
			</div>
		</AdminLayout>
	);
}
