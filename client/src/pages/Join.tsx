import { useState, type FormEvent, type JSX } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Link2Off, UserRoundPlus } from 'lucide-react';
import { SITE_ROLE_DESCRIPTIONS, SITE_ROLE_LABELS } from '@shared/access';
import { INVITE_MESSAGES, type InviteView, type JoinResult } from '@shared/invites';
import { BrandedFormLayout } from '@/components/auth';
import { accentTint } from '@/components/people/role-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { authClient } from '@/lib/auth-client';
import { ACTIVE_SITE_STORAGE_KEY } from '@/lib/site-api';

type JoinPageProps = { code: string };

const readMessage = async (response: Response, fallback: string): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message || fallback;
};

/** Opens the dashboard on the site the person just joined. */
const goToSite = (siteId: string): void => {
  try {
    localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, siteId);
  } catch (error) {
    console.error({ atFunction: 'Join.goToSite', data: { siteId, error }, message: 'Could not remember the joined site' });
  }
  window.location.href = '/admin/dashboard';
};

function JoinCard({ title, icon, children }: { title: string; icon: JSX.Element; children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <BrandedFormLayout>
      <Card className="w-full border-border/70 bg-card/95 shadow-lg shadow-black/[0.04] dark:shadow-black/25">
        <CardHeader className="justify-items-center space-y-3 pb-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-npb-accent" style={accentTint(12)} aria-hidden>
            {icon}
          </span>
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </BrandedFormLayout>
  );
}

/**
 * /join/<code>: someone opening an invite link. Signed in, they join with one button; new here, they
 * make an account on the spot and are signed in. The server decides the role and counts the places.
 */
export default function JoinPage({ code }: JoinPageProps): JSX.Element {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({ name: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const invite = useQuery<InviteView>({
    queryKey: ['invite', code],
    queryFn: async () => {
      const response = await fetch(`/api/invites/code/${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error(await readMessage(response, INVITE_MESSAGES.notFound));
      return (await response.json()) as InviteView;
    },
    retry: false,
  });

  const join = async (body?: typeof fields): Promise<void> => {
    setIsJoining(true);
    setError('');
    try {
      const response = await fetch(`/api/invites/code/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) throw new Error(await readMessage(response, INVITE_MESSAGES.failed));
      const result = (await response.json()) as JoinResult;

      if (body) {
        const signedIn = await authClient.signIn.email({ email: body.email, password: body.password });
        if (signedIn.error) {
          // The account exists; signing in by hand still works.
          window.location.href = '/admin/login';
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }
      goToSite(result.siteId);
    } catch (joinError) {
      console.error({ atFunction: 'JoinPage.join', data: { error: joinError }, message: 'Joining through an invite failed' });
      setError(joinError instanceof Error ? joinError.message : INVITE_MESSAGES.failed);
      setIsJoining(false);
    }
  };

  if (invite.isLoading) {
    return (
      <BrandedFormLayout>
        <Skeleton className="h-72 w-full rounded-xl" />
      </BrandedFormLayout>
    );
  }

  if (invite.isError || !invite.data) {
    return (
      <JoinCard title="This link doesn't work" icon={<Link2Off className="h-5 w-5" />}>
        <p className="text-center text-sm text-muted-foreground">{invite.error?.message ?? INVITE_MESSAGES.notFound}</p>
      </JoinCard>
    );
  }

  const view = invite.data;
  if (view.state !== 'open') {
    return (
      <JoinCard title="This link can't be used any more" icon={<Link2Off className="h-5 w-5" />}>
        <p className="text-center text-sm text-muted-foreground">{INVITE_MESSAGES.closed[view.state]}</p>
      </JoinCard>
    );
  }

  const roleLine = (
    <p className="text-center text-sm text-muted-foreground">
      You're invited to <span className="font-medium text-foreground">{view.siteName}</span> as{' '}
      <span className="font-medium text-foreground">{SITE_ROLE_LABELS[view.role]}</span>. {SITE_ROLE_DESCRIPTIONS[view.role]}
    </p>
  );
  const errorLine = error ? (
    <p className="text-sm text-npb-status-error" role="alert">
      {error}
    </p>
  ) : null;

  if (isAuthenticated) {
    const who = (user as { email?: string } | undefined)?.email;
    return (
      <JoinCard title={`Join ${view.siteName}`} icon={<UserRoundPlus className="h-5 w-5" />}>
        {roleLine}
        {who ? <p className="text-center text-sm text-muted-foreground">Joining as {who}.</p> : <></>}
        {errorLine ?? <></>}
        <Button className="w-full" onClick={() => void join()} disabled={isJoining}>
          {isJoining ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
          {isJoining ? 'Joining…' : 'Join'}
        </Button>
      </JoinCard>
    );
  }

  const set = (key: keyof typeof fields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));
  const ready = fields.name.trim() && fields.username.trim().length >= 2 && fields.email.includes('@') && fields.password.length >= 8;
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (ready) void join(fields);
  };

  return (
    <JoinCard title={`Join ${view.siteName}`} icon={<UserRoundPlus className="h-5 w-5" />}>
      {roleLine}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="join-name">Your name</Label>
            <Input id="join-name" autoComplete="name" value={fields.name} onChange={(event) => set('name')(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-username">Username</Label>
            <Input id="join-username" autoComplete="username" value={fields.username} onChange={(event) => set('username')(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="join-email">Email</Label>
          <Input id="join-email" type="email" autoComplete="email" value={fields.email} onChange={(event) => set('email')(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="join-password">Password</Label>
          <div className="relative">
            <Input
              id="join-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-11"
              value={fields.password}
              onChange={(event) => set('password')(event.target.value)}
              aria-describedby="join-password-help"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          <p id="join-password-help" className="text-sm text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        {errorLine}
        <Button type="submit" className="w-full" disabled={!ready || isJoining}>
          {isJoining ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
          {isJoining ? 'Joining…' : 'Create account and join'}
        </Button>
        {!ready ? (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            Fill in every field to join.
          </p>
        ) : null}
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a className="font-medium text-foreground underline-offset-4 hover:underline" href={`/admin/login?next=${encodeURIComponent(`/join/${code}`)}`}>
          Sign in first
        </a>
      </p>
    </JoinCard>
  );
}
