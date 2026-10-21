import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ChangePasswordArgs = {
	currentPassword: string;
	newPassword: string;
	revokeOtherSessions?: boolean;
};

type ChangePasswordResult = {
	data: { user: { id: string } } | null;
	error: { code?: string; message?: string } | null;
};

const changePassword = vi.hoisted(() =>
	vi.fn(async (_args: ChangePasswordArgs): Promise<ChangePasswordResult> => ({
		data: { user: { id: 'u1' } },
		error: null,
	})),
);
const successToast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-client', () => ({ authClient: { changePassword } }));
vi.mock('sonner', () => ({ toast: { success: successToast, error: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'someone@example.com' } }) }));

const { ChangePasswordDialog } = await import('@/components/account/change-password-dialog');
const { NoDashboardAccess } = await import('@/components/admin/no-dashboard-access');

const typeInto = (label: string, value: string): void => {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const submit = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
};

beforeEach(() => {
	changePassword.mockClear();
	successToast.mockClear();
	changePassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});
describe('change password dialog', () => {
	it('sends the typed passwords and signs other devices out', async () => {
		render(<ChangePasswordDialog open onOpenChange={() => {}} />);

		typeInto('Current password', 'old-secret-1');
		typeInto('New password', 'new-secret-2');
		typeInto('Confirm new password', 'new-secret-2');
		submit();

		await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
		expect(changePassword).toHaveBeenCalledWith({
			currentPassword: 'old-secret-1',
			newPassword: 'new-secret-2',
			revokeOtherSessions: true,
		} satisfies ChangePasswordArgs);
	});

	it('says the current password is wrong in plain words and stays open', async () => {
		changePassword.mockResolvedValue({
			data: null,
			error: { code: 'INVALID_PASSWORD', message: 'Invalid password' },
		});
		const onOpenChange = vi.fn();
		render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);

		typeInto('Current password', 'old-secret-1');
		typeInto('New password', 'new-secret-2');
		typeInto('Confirm new password', 'new-secret-2');
		submit();

		expect(await screen.findByRole('alert')).toHaveTextContent("That current password isn't right.");
		expect(screen.queryByText('Invalid password')).not.toBeInTheDocument();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
		expect(successToast).not.toHaveBeenCalled();
	});

	it('refuses a new password that is too short without asking the server', async () => {
		render(<ChangePasswordDialog open onOpenChange={() => {}} />);

		typeInto('Current password', 'old-secret-1');
		typeInto('New password', 'short');
		typeInto('Confirm new password', 'short');
		submit();

		expect(await screen.findByText('Your new password needs at least 8 characters.')).toBeInTheDocument();
		expect(changePassword).not.toHaveBeenCalled();
	});

	it('refuses two passwords that do not match without asking the server', async () => {
		render(<ChangePasswordDialog open onOpenChange={() => {}} />);

		typeInto('Current password', 'old-secret-1');
		typeInto('New password', 'new-secret-2');
		typeInto('Confirm new password', 'new-secret-3');
		submit();

		expect(await screen.findByText("The two passwords don't match.")).toBeInTheDocument();
		expect(changePassword).not.toHaveBeenCalled();
	});
});

describe('the screen for people with no dashboard', () => {
	it('lets them change their password too', async () => {
		render(<NoDashboardAccess />);

		fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByLabelText('Current password')).toBeInTheDocument();
		expect(screen.getByLabelText('New password')).toBeInTheDocument();
	});
});
