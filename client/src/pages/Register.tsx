import { useState, type FormEvent, type JSX } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, Lock, UserRoundPlus } from 'lucide-react';
import { ACCESS_MESSAGES } from '@shared/access';
import { BrandedFormLayout } from '@/components/auth';
import { accentTint } from '@/components/people/role-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';

type SignUpStatus = { open: boolean; siteName: string | null };

function RegisterCard({ title, icon, children }: { title: string; icon: JSX.Element; children: JSX.Element | JSX.Element[] }): JSX.Element {
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
 * Visitor sign-up. Each site decides in Settings → Discussion whether visitors may make an account;
 * accounts made here can comment and keep a profile. Joining a site's team takes an invite link.
 */
export default function Register(): JSX.Element {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({ name: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const status = useQuery<SignUpStatus>({
    queryKey: ['/api/public/sign-up-status'],
    queryFn: async () => {
      const response = await fetch('/api/public/sign-up-status');
      if (!response.ok) throw new Error(`Sign-up status ${response.status}`);
      return (await response.json()) as SignUpStatus;
    },
    retry: false,
  });

  const set = (key: keyof typeof fields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));
  const ready = fields.name.trim() && fields.username.trim().length >= 2 && fields.email.includes('@') && fields.password.length >= 8;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!ready) return;
    setIsSaving(true);
    setError('');
    const result = await authClient.signUp.email({
      name: fields.name.trim(),
      username: fields.username.trim(),
      email: fields.email.trim(),
      password: fields.password,
    });
    setIsSaving(false);
    if (result.error) {
      console.error({ atFunction: 'Register.submit', data: { email: fields.email, error: result.error }, message: 'Visitor sign-up failed' });
      setError(result.error.message || 'We couldn’t create your account. Try again.');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    setDone(true);
  };

  if (status.isLoading) {
    return (
      <BrandedFormLayout>
        <Skeleton className="h-72 w-full rounded-xl" />
      </BrandedFormLayout>
    );
  }

  if (status.isError || !status.data?.open) {
    return (
      <RegisterCard title="Sign-up is closed" icon={<Lock className="h-5 w-5" />}>
        <p className="text-center text-sm text-muted-foreground">
          {status.isError ? "We couldn't check whether this site takes new accounts. Try again in a moment." : ACCESS_MESSAGES.signUpClosed}
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/admin/login">Sign in</a>
        </Button>
      </RegisterCard>
    );
  }

  const siteName = status.data.siteName ?? 'this site';
  if (done) {
    return (
      <RegisterCard title="You're signed up" icon={<CheckCircle2 className="h-5 w-5" />}>
        <p className="text-center text-sm text-muted-foreground">You can now comment on {siteName} as {fields.name.trim()}.</p>
        <Button asChild className="w-full">
          <a href="/">Go to {siteName}</a>
        </Button>
      </RegisterCard>
    );
  }

  return (
    <RegisterCard title={`Create an account on ${siteName}`} icon={<UserRoundPlus className="h-5 w-5" />}>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="register-name">Your name</Label>
            <Input id="register-name" autoComplete="name" value={fields.name} onChange={(event) => set('name')(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-username">Username</Label>
            <Input id="register-username" autoComplete="username" value={fields.username} onChange={(event) => set('username')(event.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" type="email" autoComplete="email" value={fields.email} onChange={(event) => set('email')(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-11"
              value={fields.password}
              onChange={(event) => set('password')(event.target.value)}
              aria-describedby="register-password-help"
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
          <p id="register-password-help" className="text-sm text-muted-foreground">
            At least 8 characters.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-npb-status-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={!ready || isSaving}>
          {isSaving ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
          {isSaving ? 'Creating account…' : 'Create account'}
        </Button>
        {!ready ? (
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            Fill in every field to continue.
          </p>
        ) : null}
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a className="font-medium text-foreground underline-offset-4 hover:underline" href="/admin/login">
          Sign in
        </a>
      </p>
    </RegisterCard>
  );
}
