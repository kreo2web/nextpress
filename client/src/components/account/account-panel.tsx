import { useState, type JSX } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SurfaceCard } from '@/components/PageBuilder/shared/surface-card';
import { AccountProfileCard } from './account-profile-card';
import { ChangePasswordDialog } from './change-password-dialog';
import { signOutAndLeave } from './sign-out';
import { getAccountDisplayName, getAccountInitials, useAccountProfile } from './use-account-profile';

/**
 * Everything a signed-in person can change about their own account: who they are, the password
 * and signing out. Lives on /admin/account and in Settings, so it takes no props.
 */
export function AccountPanel(): JSX.Element {
	const [passwordOpen, setPasswordOpen] = useState(false);
	const profile = useAccountProfile();
	const { values, user } = profile;
	// The header shows the saved name, so typing in the form does not change it until saved.
	const savedName = { firstName: user?.firstName, lastName: user?.lastName, username: user?.username };


	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Avatar className="size-12">
					{user?.profileImageUrl ? <AvatarImage src={user.profileImageUrl} alt="" /> : null}
					<AvatarFallback className="bg-npb-accent/15 text-sm font-semibold text-npb-accent">
						{getAccountInitials(savedName)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="truncate text-base font-semibold text-npb-text-primary">
						{getAccountDisplayName(savedName)}
					</p>
					<p className="truncate text-sm text-npb-text-muted">{user?.email ?? ''}</p>
				</div>
			</div>

			<AccountProfileCard
				values={values}
				email={user?.email ?? null}
				isSaving={profile.isSaving}
				canSave={profile.canSave}
				saveBlockedReason={profile.saveBlockedReason}
				saveError={profile.saveError}
				onFieldChange={profile.setField}
				onSave={() => void profile.save()}
			/>

			<SurfaceCard padding="md" header={{ title: 'Password' }}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-npb-text-secondary">Change the password you sign in with.</p>
					<Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>
						<KeyRound className="mr-2 h-4 w-4" aria-hidden />
						Change password
					</Button>
				</div>
			</SurfaceCard>

			<div className="flex justify-end">
				<Button type="button" variant="ghost" onClick={() => void signOutAndLeave({ atFunction: 'AccountPanel.signOut', userId: user?.id })}>
					<LogOut className="mr-2 h-4 w-4" aria-hidden />
					Log out
				</Button>
			</div>

			<ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
		</div>
	);
}
