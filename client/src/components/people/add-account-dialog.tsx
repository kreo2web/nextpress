import { useState, type FormEvent, type JSX } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { SITE_ROLES, SITE_ROLE_LABELS, type SiteRoleName } from '@shared/access';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AiChoiceChip } from '@/components/settings/ai-settings/ai-choice-chip';
import { showErrorToast, showSuccessToast } from '@/lib/sonner-toast';
import { useEveryone } from './use-people';

type AddAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
};

const EMPTY = { name: '', email: '', username: '', password: '' };

/**
 * Main-site admins can make an account directly (an invite link is usually easier). The new person
 * can get a role on the site that's open in the dashboard right away.
 */
export function AddAccountDialog({ open, onOpenChange, siteId, siteName }: AddAccountDialogProps): JSX.Element {
  const { add } = useEveryone({ enabled: false });
  const [fields, setFields] = useState(EMPTY);
  const [role, setRole] = useState<SiteRoleName | 'none'>('editor');
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof EMPTY) => (value: string) => setFields((current) => ({ ...current, [key]: value }));
  const passwordShort = fields.password.length > 0 && fields.password.length < 8;
  const ready = fields.name.trim() && fields.email.includes('@') && fields.username.trim().length >= 2 && fields.password.length >= 8;

  const close = (next: boolean): void => {
    onOpenChange(next);
    if (!next) setFields(EMPTY);
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!ready) return;
    add.mutate(
      { ...fields, ...(role !== 'none' ? { siteId, role } : {}) },
      {
        onSuccess: () => {
          showSuccessToast(`${fields.name} can now sign in`);
          close(false);
        },
        onError: (error) => showErrorToast(error.message || "Couldn't add the account. Try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5" aria-hidden />
            Add an account
          </DialogTitle>
        </DialogHeader>
        <form id="add-account-form" onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" value={fields.name} onChange={(event) => set('name')(event.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-username">Username</Label>
              <Input id="account-username" value={fields.username} onChange={(event) => set('username')(event.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" type="email" value={fields.email} onChange={(event) => set('email')(event.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-password">Password</Label>
            <div className="relative">
              <Input
                id="account-password"
                type={showPassword ? 'text' : 'password'}
                value={fields.password}
                onChange={(event) => set('password')(event.target.value)}
                autoComplete="new-password"
                className="pr-11"
                aria-invalid={passwordShort}
                aria-describedby="account-password-help"
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
            <p id="account-password-help" className={`text-sm ${passwordShort ? 'text-npb-status-error' : 'text-npb-text-muted'}`}>
              At least 8 characters. Share it with them privately.
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-npb-text-primary">Role on {siteName}</legend>
            <div className="flex flex-wrap gap-2">
              {SITE_ROLES.map((choice) => (
                <AiChoiceChip key={choice} isActive={role === choice} onClick={() => setRole(choice)}>
                  {SITE_ROLE_LABELS[choice]}
                </AiChoiceChip>
              ))}
              <AiChoiceChip isActive={role === 'none'} onClick={() => setRole('none')}>
                No role yet
              </AiChoiceChip>
            </div>
          </fieldset>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="add-account-form" disabled={!ready || add.isPending}>
            {add.isPending ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
            {add.isPending ? 'Adding…' : 'Add account'}
          </Button>
        </DialogFooter>
        {!ready && !add.isPending ? (
          <p className="-mt-2 text-right text-xs text-npb-text-muted" aria-live="polite">
            Fill in name, username, email and a password to add the account.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
