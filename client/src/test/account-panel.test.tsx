import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';

type UpdateUserArgs = { firstName?: string; lastName?: string; username?: string };
type AuthResult = { data: object | null; error: { code?: string; message?: string } | null };

type FakeUser = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	username: string;
};

const SIGNED_IN_USER: FakeUser = {
	id: 'u1',
	email: 'ada@example.com',
	firstName: 'Ada',
	lastName: 'Lovelace',
	username: 'ada',
};

const authState = vi.hoisted(() => ({
	user: null as FakeUser | null,
	refetch: vi.fn(async () => ({ data: null })),
}));
const updateUser = vi.hoisted(() => vi.fn(async (_args: UpdateUserArgs): Promise<AuthResult> => ({ data: {}, error: null })));
const signOut = vi.hoisted(() => vi.fn(async () => ({ data: {}, error: null })));
const successToast = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useAuth', () => ({
	useAuth: () => ({ user: authState.user, refetch: authState.refetch, isLoading: false, isAuthenticated: true }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser, signOut, changePassword: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: successToast, error: vi.fn() } }));

const { AccountPanel } = await import('@/components/account/account-panel');

const typeInto = (label: string, value: string): void => {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const saveButton = (): HTMLElement => screen.getByRole('button', { name: 'Save profile' });

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	authState.user = { ...SIGNED_IN_USER };
	authState.refetch.mockClear();
	updateUser.mockReset();
	updateUser.mockResolvedValue({ data: {}, error: null });
	successToast.mockClear();
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	consoleError.mockRestore();
});

describe('AccountPanel profile', () => {
	it('saves the changed names and username, then refetches the signed-in user', async () => {
		render(<AccountPanel />);

		typeInto('First name', 'Augusta');
		typeInto('Username', '  ada_l  ');
		fireEvent.click(saveButton());

		await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
		expect(updateUser).toHaveBeenCalledWith({ firstName: 'Augusta', username: 'ada_l' });
		await waitFor(() => expect(authState.refetch).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(successToast).toHaveBeenCalledWith('Profile saved.', expect.anything()));
	});

	it('sends only what changed, so an unchanged username is never checked again', async () => {
		render(<AccountPanel />);

		typeInto('Last name', 'Byron');
		fireEvent.click(saveButton());

		await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ lastName: 'Byron' }));
	});

	it('lets an account with no username change its name', async () => {
		authState.user = { ...SIGNED_IN_USER, username: '' };
		render(<AccountPanel />);

		typeInto('First name', 'Augusta');
		expect(saveButton()).toBeEnabled();
		fireEvent.click(saveButton());

		await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ firstName: 'Augusta' }));
	});

	it('says the username is taken in plain words and logs the cause', async () => {
		updateUser.mockResolvedValueOnce({
			data: null,
			error: { code: 'USERNAME_IS_ALREADY_TAKEN', message: 'Username is already taken. Please try another.' },
		});
		render(<AccountPanel />);

		typeInto('Username', 'grace');
		fireEvent.click(saveButton());

		expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken. Try another.');
		expect(authState.refetch).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			expect.objectContaining({
				atFunction: 'useAccountProfile.save',
				data: expect.objectContaining({ userId: 'u1', code: 'USERNAME_IS_ALREADY_TAKEN' }),
			}),
		);
	});

	it('keeps save disabled and says why until something changes', () => {
		render(<AccountPanel />);

		expect(saveButton()).toBeDisabled();
		expect(screen.getByText('Change your name or username to save.')).toBeInTheDocument();

		typeInto('Username', '');

		expect(saveButton()).toBeDisabled();
		expect(screen.getByText("Your username can't be empty.")).toBeInTheDocument();
	});

	it('shows the email read-only with the reason it cannot change', () => {
		render(<AccountPanel />);

		expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
		expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
		expect(screen.getByText("Email can't be changed here yet.")).toBeInTheDocument();
	});
});

describe('AccountPanel password and sign out', () => {
	it('opens the change password dialog from the page', () => {
		render(<AccountPanel />);

		fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByLabelText('Current password')).toBeInTheDocument();
	});
});

/** Settings is a large page; its children and the admin shell are stubbed so only the tab wiring is under test. */
describe('Settings account tab', () => {
	const settingsData = {
		general: { siteName: 'Test site', siteDescription: '', siteUrl: 'https://example.com', adminEmail: 'admin@example.com', timezone: 'UTC' },
		reading: { rssPosts: 10, rssEnabled: true, discourageSearchIndexing: false, descriptionFrom: 'auto' },
		discussion: { enableComments: true, moderateComments: true, enableRegistration: false },
	};

	beforeEach(() => {
		vi.resetModules();
	});

	it('opens on ?tab=account and shows the account panel without the page Save button', async () => {
		vi.doMock('@tanstack/react-query', async (importOriginal) => {
			const actual = await importOriginal<typeof import('@tanstack/react-query')>();
			return {
				...actual,
				useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
					const key = String(queryKey[0]);
					if (key === '/api/settings') return { data: { status: true, data: settingsData }, isLoading: false };
					if (key === '/api/site') {
						return {
							data: {
								status: true,
								data: { id: 'site-1', logoUrl: null, faviconUrl: null, activeThemeId: null },
							},
							isLoading: false,
							error: null,
						};
					}
					return { data: [], isLoading: false, error: null };
				},
			};
		});
		vi.doMock('@/components/AdminLayout', () => ({
			AdminLayout: ({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }): JSX.Element => (
				<div>
					<h1>{title}</h1>
					{actions}
					{children}
				</div>
			),
		}));
		vi.doMock('@/hooks/useActiveSite', () => ({ useActiveSite: () => ({ activeSiteId: 'site-1' }) }));
		vi.doMock('@/hooks/use-site-access', () => ({
			useSiteAccess: () => ({ can: () => true, isMainSiteAdmin: true, isLoading: false, error: null }),
		}));
		vi.doMock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
		vi.doMock('@/components/settings/ai-settings', () => ({ AiSettingsPanel: () => null }));
		vi.doMock('@/components/domain', () => ({ DomainInputWithVerify: () => null }));
		vi.doMock('@/components/settings/ApiKeysPanel', () => ({ ApiKeysPanel: () => null }));
		vi.doMock('@/components/settings/timezone-field', () => ({ TimezoneField: () => null }));
		vi.doMock('@/components/media/MediaPickerDialog', () => ({ default: () => null }));

		window.history.pushState({}, '', '/admin/settings?tab=account');
		const { default: Settings } = await import('@/pages/Settings');
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		render(
			<QueryClientProvider client={queryClient}>
				<Settings />
			</QueryClientProvider>,
		);

		expect(await screen.findByRole('tab', { name: 'Your account' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByLabelText('First name')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

		window.history.pushState({}, '', '/');
	});
});
