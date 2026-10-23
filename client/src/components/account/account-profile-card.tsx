import type { FormEvent, JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { SettingsLabel } from '@/components/PageBuilder/shared/settings-label';
import { SurfaceCard } from '@/components/PageBuilder/shared/surface-card';
import type { AccountProfileField, AccountProfileValues } from './use-account-profile';

export type AccountProfileCardProps = {
	values: AccountProfileValues;
	email: string | null;
	isSaving: boolean;
	canSave: boolean;
	saveBlockedReason: string | null;
	saveError: string | null;
	onFieldChange: (field: AccountProfileField, value: string) => void;
	onSave: () => void;
};

const FIELDS: { field: AccountProfileField; label: string; id: string; autoComplete: string }[] = [
	{ field: 'firstName', label: 'First name', id: 'account-first-name', autoComplete: 'given-name' },
	{ field: 'lastName', label: 'Last name', id: 'account-last-name', autoComplete: 'family-name' },
	{ field: 'username', label: 'Username', id: 'account-username', autoComplete: 'username' },
];

/**
 * The profile form. Presentational only: the values, the save and the reasons come from
 * useAccountProfile, so this card just draws them.
 */
export function AccountProfileCard({
	values,
	email,
	isSaving,
	canSave,
	saveBlockedReason,
	saveError,
	onFieldChange,
	onSave,
}: AccountProfileCardProps): JSX.Element {
	const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
		event.preventDefault();
		if (canSave) onSave();
	};

	return (
		<SurfaceCard padding="none" header={{ title: 'Profile' }}>
			<form onSubmit={handleSubmit} noValidate>
				<div className="grid gap-4 p-4 sm:grid-cols-2">
					{FIELDS.map(({ field, label, id, autoComplete }) => (
						<div key={field} className="grid gap-1.5">
							<SettingsLabel htmlFor={id}>{label}</SettingsLabel>
							<Input
								id={id}
								value={values[field]}
								autoComplete={autoComplete}
								disabled={isSaving}
								onChange={(event) => onFieldChange(field, event.target.value)}
							/>
						</div>
					))}

					<div className="grid gap-1.5 sm:col-span-2">
						<SettingsLabel htmlFor="account-email">Email</SettingsLabel>
						<Input id="account-email" value={email ?? ''} readOnly aria-describedby="account-email-hint" />
						<p id="account-email-hint" className="text-xs text-npb-text-muted">
							Email can't be changed here yet.
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-npb-border-default px-4 py-3">
					<div className="min-w-0 text-sm">
						{saveError ? (
							<p role="alert" className="text-npb-status-error">
								{saveError}
							</p>
						) : !canSave && saveBlockedReason ? (
							<p className="text-npb-text-muted">{saveBlockedReason}</p>
						) : null}
					</div>
					<Button type="submit" className="npb-btn-accent" disabled={!canSave}>
						{isSaving ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
						{isSaving ? 'Saving…' : 'Save profile'}
					</Button>
				</div>
			</form>
		</SurfaceCard>
	);
}
