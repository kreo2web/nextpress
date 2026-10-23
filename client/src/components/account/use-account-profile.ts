import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authClient } from '@/lib/auth-client';
import { showSuccessToast } from '@/lib/sonner-toast';

/** The name and username fields a person can change on their own account. */
export type AccountProfileValues = {
	firstName: string;
	lastName: string;
	username: string;
};

export type AccountProfileField = keyof AccountProfileValues;

/** The signed-in user as the server returns it; any name field may be empty in the database. */
export type AccountProfileUser = {
	id?: string;
	email?: string | null;
	profileImageUrl?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
};

/** The name fields, as the avatar and header read them. */
type AccountNameFields = { firstName?: string | null; lastName?: string | null; username?: string | null };

type AuthFailure = { code?: string; message?: string };

const GENERIC_SAVE_FAILURE = "We couldn't save your profile. Try again in a moment.";

/** What the server says, in words a person can act on. */
const SAVE_FAILURE_MESSAGES: Record<string, string> = {
	USERNAME_IS_ALREADY_TAKEN: 'That username is taken. Try another.',
	USERNAME_TOO_SHORT: 'That username is too short. Try a longer one.',
	USERNAME_TOO_LONG: 'That username is too long. Try a shorter one.',
	INVALID_USERNAME: 'That username has characters that are not allowed. Use letters, numbers and underscores.',
	UNAUTHORIZED: 'Your session has ended. Sign in again, then try that.',
};

/**
 * The text shown to a person who cannot save yet. Null means saving is open.
 * Kept here, not in the card, so the reason always matches the rule that blocks saving.
 */
export const NOTHING_CHANGED_REASON = 'Change your name or username to save.';
export const EMPTY_USERNAME_REASON = "Your username can't be empty.";

/** Two letters for the avatar: first name and last name, else the first letters of the username. */
export function getAccountInitials({ firstName, lastName, username }: AccountNameFields): string {
	const first = firstName?.trim() ?? '';
	const last = lastName?.trim() ?? '';
	if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
	if (first) return first.slice(0, 2).toUpperCase();
	return (username?.trim() ?? '').slice(0, 2).toUpperCase() || '?';
}

/** The name shown next to the avatar: full name when there is one, else the username. */
export function getAccountDisplayName({ firstName, lastName, username }: AccountNameFields): string {
	const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
	return fullName || username?.trim() || 'Your account';
}

function toProfileValues(user: AccountProfileUser | null | undefined): AccountProfileValues {
	return {
		firstName: user?.firstName ?? '',
		lastName: user?.lastName ?? '',
		username: user?.username ?? '',
	};
}

function isSameProfile(left: AccountProfileValues, right: AccountProfileValues): boolean {
	return left.firstName === right.firstName && left.lastName === right.lastName && left.username === right.username;
}

/**
 * Only the fields that changed, trimmed. WHY only changed ones: the username check refuses a
 * username already in use, and resending your own unchanged one must never trip it.
 */
function toSavePayload({ draft, saved }: { draft: AccountProfileValues; saved: AccountProfileValues }): Partial<AccountProfileValues> {
	const fields: AccountProfileField[] = ['firstName', 'lastName', 'username'];
	return Object.fromEntries(
		fields.filter((field) => draft[field].trim() !== saved[field].trim()).map((field) => [field, draft[field].trim()]),
	);
}

export type AccountProfileState = {
	user: AccountProfileUser | null | undefined;
	values: AccountProfileValues;
	isDirty: boolean;
	isSaving: boolean;
	canSave: boolean;
	saveBlockedReason: string | null;
	saveError: string | null;
	setField: (field: AccountProfileField, value: string) => void;
	save: () => Promise<void>;
};

/**
 * Holds the profile form: the typed values, whether anything changed, and the save.
 * Saving goes through Better Auth's updateUser, then refetches the signed-in user so the
 * top bar and this page show the new name at once.
 */
export function useAccountProfile(): AccountProfileState {
	const { user, refetch } = useAuth();
	const savedValues = toProfileValues(user as AccountProfileUser | null | undefined);
	const [draft, setDraft] = useState<AccountProfileValues | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const values = draft ?? savedValues;
	const isDirty = draft !== null && !isSameProfile(draft, savedValues);
	// A blank username blocks saving only when the person cleared one; an account without a username can still change its name.
	const clearedUsername = savedValues.username.trim() !== '' && values.username.trim() === '';
	const saveBlockedReason = !isDirty ? NOTHING_CHANGED_REASON : clearedUsername ? EMPTY_USERNAME_REASON : null;
	const canSave = saveBlockedReason === null && !isSaving;

	const setField = (field: AccountProfileField, value: string): void => {
		setSaveError(null);
		setDraft({ ...values, [field]: value });
	};

	const save = async (): Promise<void> => {
		if (!draft || !canSave) return;
		const payload = toSavePayload({ draft, saved: savedValues });
		setIsSaving(true);
		setSaveError(null);
		try {
			const result = await authClient.updateUser(payload);
			if (result.error) {
				const code = (result.error as AuthFailure).code ?? '';
				console.error({
					atFunction: 'useAccountProfile.save',
					data: { userId: user?.id, code, error: result.error },
					message: 'The server refused the profile update',
				});
				setSaveError(SAVE_FAILURE_MESSAGES[code] ?? GENERIC_SAVE_FAILURE);
				return;
			}
			await refetch();
			setDraft(null);
			showSuccessToast('Profile saved.');
		} catch (error) {
			console.error({
				atFunction: 'useAccountProfile.save',
				data: { userId: user?.id, error },
				message: 'Saving the profile failed',
			});
			setSaveError(GENERIC_SAVE_FAILURE);
		} finally {
			setIsSaving(false);
		}
	};

	return {
		user: user as AccountProfileUser | null | undefined,
		values,
		isDirty,
		isSaving,
		canSave,
		saveBlockedReason,
		saveError,
		setField,
		save,
	};
}
