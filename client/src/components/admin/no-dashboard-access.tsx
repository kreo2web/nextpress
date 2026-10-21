import { useState, type JSX } from 'react';
import { KeyRound } from 'lucide-react';
import { BrandedFormLayout } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import { useAuth } from '@/hooks/useAuth';
import { authClient } from '@/lib/auth-client';
import { accentTint } from '@/components/people/role-badge';

/**
 * For someone signed in who has no dashboard role on any site (a commenter account, or someone
 * whose role was taken away). They get a clear next step instead of empty screens.
 */
export function NoDashboardAccess(): JSX.Element {
  const { user } = useAuth();
  const [isLeaving, setIsLeaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const signOut = async (): Promise<void> => {
    setIsLeaving(true);
    try {
      await authClient.signOut();
    } catch (error) {
      console.error({ atFunction: 'NoDashboardAccess.signOut', data: { error }, message: 'Sign-out failed; going home anyway' });
    }
    window.location.href = '/';
  };

  return (
    <BrandedFormLayout>
      <Card className="w-full border-border/70 bg-card/95 shadow-lg shadow-black/[0.04] dark:shadow-black/25">
        <CardHeader className="justify-items-center space-y-3 pb-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-npb-accent" style={accentTint(12)} aria-hidden>
            <KeyRound className="h-5 w-5" />
          </span>
          <CardTitle className="text-xl font-semibold tracking-tight">No dashboard access yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-sm text-muted-foreground">
            {user?.email ? <>You're signed in as <span className="font-medium text-foreground">{user.email}</span>. </> : null}
            To work on a site, ask its admin for an invite link and open it while signed in.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <a href="/">Go to the site</a>
            </Button>
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
            <Button onClick={() => void signOut()} disabled={isLeaving}>
              {isLeaving ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Outside the card, so the dialog can open over it. */}
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </BrandedFormLayout>
  );
}
