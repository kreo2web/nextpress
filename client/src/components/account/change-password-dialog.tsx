import { useState, type JSX } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { showSuccessToast } from '@/lib/sonner-toast';

/** The shortest password the server accepts (matches the auth setup). */
const MIN_PASSWORD_LENGTH = 8;

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current password.'),
		newPassword: z
			.string()
			.min(MIN_PASSWORD_LENGTH, `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`),
		confirmPassword: z.string().min(1, 'Type your new password once more.'),
	})
	.refine((values) => values.newPassword === values.confirmPassword, {
		message: "The two passwords don't match.",
		path: ['confirmPassword'],
	});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

/** What the server says, in words a person can act on. */
const FAILURE_MESSAGES: Record<string, string> = {
	INVALID_PASSWORD: "That current password isn't right.",
	PASSWORD_TOO_SHORT: `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
	PASSWORD_TOO_LONG: 'That password is too long.',
	CREDENTIAL_ACCOUNT_NOT_FOUND: "This account doesn't sign in with a password, so there's nothing to change here.",
	UNAUTHORIZED: 'Your session has ended. Sign in again, then try that.',
};

const GENERIC_FAILURE = "We couldn't change the password. Try again in a moment.";

/** The form's id, so the footer button can submit it from outside the form element. */
const CHANGE_PASSWORD_FORM_ID = 'change-password-form';

type AuthFailure = { code?: string; message?: string };

/** One password field with a show/hide toggle. */
function PasswordField({
	form,
	name,
	label,
	autoComplete,
	visible,
	onToggleVisible,
}: {
	form: UseFormReturn<ChangePasswordValues>;
	name: PasswordFieldName;
	label: string;
	autoComplete: 'current-password' | 'new-password';
	visible: boolean;
	onToggleVisible: () => void;
}): JSX.Element {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<FormLabel>{label}</FormLabel>
					<div className="relative">
						<FormControl>
							<Input
								type={visible ? 'text' : 'password'}
								autoComplete={autoComplete}
								className="pr-10"
								{...field}
							/>
						</FormControl>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={onToggleVisible}
							aria-label={visible ? 'Hide password' : 'Show password'}
							aria-pressed={visible}
						>
							{visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
						</Button>
					</div>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export type ChangePasswordDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Lets a signed-in person set a new password. The server checks the current one, so it has to be
 * typed. Other devices are signed out when it changes; this browser stays in.
 */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps): JSX.Element {
	const [isSaving, setIsSaving] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [visible, setVisible] = useState<Record<PasswordFieldName, boolean>>({
		currentPassword: false,
		newPassword: false,
		confirmPassword: false,
	});

	const form = useForm<ChangePasswordValues>({
		resolver: zodResolver(changePasswordSchema),
		defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
	});

	const close = (next: boolean): void => {
		onOpenChange(next);
		if (next) return;
		form.reset();
		setFailure(null);
		setVisible({ currentPassword: false, newPassword: false, confirmPassword: false });
	};

	const toggleVisible = (name: PasswordFieldName): void => {
		setVisible((current) => ({ ...current, [name]: !current[name] }));
	};

	const onSubmit = async (values: ChangePasswordValues): Promise<void> => {
		setIsSaving(true);
		setFailure(null);
		try {
			const result = await authClient.changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
				revokeOtherSessions: true,
			});

			if (result.error) {
				const code = (result.error as AuthFailure).code ?? '';
				setFailure(FAILURE_MESSAGES[code] ?? GENERIC_FAILURE);
				return;
			}

			showSuccessToast('Password changed.');
			close(false);
		} catch (error) {
			console.error({
				atFunction: 'ChangePasswordDialog.submit',
				data: { error },
				message: 'Changing the password failed',
			});
			setFailure(GENERIC_FAILURE);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<KeyRound className="h-5 w-5" aria-hidden />
						Change password
					</DialogTitle>
					<DialogDescription>Your other devices are signed out when the password changes.</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						id={CHANGE_PASSWORD_FORM_ID}
						onSubmit={form.handleSubmit((values) => void onSubmit(values))}
						className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1"
					>
						<PasswordField
							form={form}
							name="currentPassword"
							label="Current password"
							autoComplete="current-password"
							visible={visible.currentPassword}
							onToggleVisible={() => toggleVisible('currentPassword')}
						/>
						<PasswordField
							form={form}
							name="newPassword"
							label="New password"
							autoComplete="new-password"
							visible={visible.newPassword}
							onToggleVisible={() => toggleVisible('newPassword')}
						/>
						<PasswordField
							form={form}
							name="confirmPassword"
							label="Confirm new password"
							autoComplete="new-password"
							visible={visible.confirmPassword}
							onToggleVisible={() => toggleVisible('confirmPassword')}
						/>

						{failure ? (
							<p role="alert" className="text-sm text-npb-status-error">
								{failure}
							</p>
						) : null}
					</form>
				</Form>

				<DialogFooter className="gap-2">
					<Button type="button" variant="outline" onClick={() => close(false)} disabled={isSaving}>
						Cancel
					</Button>
					<Button
						type="submit"
						form={CHANGE_PASSWORD_FORM_ID}
						disabled={isSaving}
					>
						{isSaving ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
						{isSaving ? 'Changing…' : 'Change password'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
