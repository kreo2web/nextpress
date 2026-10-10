import { useState, type JSX } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  version: string;
  password: string;
  onPasswordChange: (next: string) => void;
  onSubmit: () => void;
  error: string | null;
  submitting: boolean;
};

export const CORE_UPDATE_PASSWORD_FORM_ID = 'core-update-password-form';

/** Step 2: the person confirms with their password, right before anything starts. */
export function CoreUpdatePasswordStep({ version, password, onPasswordChange, onSubmit, error, submitting }: Props): JSX.Element {
  const [visible, setVisible] = useState(false);
  const hintId = 'core-update-password-hint';

  return (
    <form
      id={CORE_UPDATE_PASSWORD_FORM_ID}
      className="mx-auto grid w-full max-w-sm justify-items-center gap-4 rounded-[var(--npb-radius-surface)] bg-npb-surface-raised px-5 py-6 text-center"
      onSubmit={(event) => {
        event.preventDefault();
        if (password && !submitting) onSubmit();
      }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-npb-accent/12 text-npb-accent">
        <KeyRound className="h-5 w-5" aria-hidden />
      </span>
      <div className="grid gap-1">
        <p className="font-medium text-npb-text-primary">Enter your password</p>
        <p className="text-sm text-npb-text-secondary">to update NextPress to {version}</p>
      </div>
      <div className="grid w-full gap-2 text-left">
        <Label htmlFor="core-update-password" className="sr-only">
          Password
        </Label>
        <div className="relative">
          <Input
            id="core-update-password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-npb-text-muted hover:text-npb-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <p id={hintId} role={error ? 'alert' : undefined} className={error ? 'text-sm text-npb-status-error' : 'text-sm text-npb-text-muted'}>
          {error ?? (password ? ' ' : 'Enter your password to continue.')}
        </p>
      </div>
    </form>
  );
}
