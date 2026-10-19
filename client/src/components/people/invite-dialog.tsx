import { useState, type JSX } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { SITE_ROLES, SITE_ROLE_DESCRIPTIONS, SITE_ROLE_LABELS, isAtLeast, type SiteRoleName, type SiteStanding } from '@shared/access';
import { INVITE_LIMITS, type InviteSummary } from '@shared/invites';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AiChoiceChip } from '@/components/settings/ai-settings/ai-choice-chip';
import { showErrorToast } from '@/lib/sonner-toast';
import { describeInviteLimits } from './invite-words';
import { inviteUrl, useInviteLinks } from './use-people';

type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteUrl: string | null | undefined;
  myStanding: SiteStanding | null;
};

type Places = 'one' | 'some' | 'unlimited';
const END_CHOICES: Array<{ label: string; days: number | null }> = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'Never', days: null },
];

/** Copies text, falling back to selecting it when the browser blocks the clipboard. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error({ atFunction: 'copyText', data: { error }, message: 'The browser refused the clipboard' });
    return false;
  }
};

/** Makes an invite link in two steps: choose who and for how long, then copy the link. */
export function InviteDialog({ open, onOpenChange, siteId, siteUrl, myStanding }: InviteDialogProps): JSX.Element {
  const { create } = useInviteLinks(siteId);
  const roleChoices = SITE_ROLES.filter((role) => isAtLeast({ a: myStanding, b: role }));
  const [role, setRole] = useState<SiteRoleName>('editor');
  const [places, setPlaces] = useState<Places>('one');
  const [someCount, setSomeCount] = useState('5');
  const [days, setDays] = useState<number | null>(INVITE_LIMITS.defaultDays);
  const [note, setNote] = useState('');
  const [made, setMade] = useState<InviteSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const count = Number(someCount);
  const countIsValid = Number.isInteger(count) && count >= 1 && count <= INVITE_LIMITS.maxPlaces;
  const maxUses = places === 'one' ? 1 : places === 'unlimited' ? null : count;
  const canMake = places !== 'some' || countIsValid;

  const reset = (): void => {
    setMade(null);
    setCopied(false);
    setNote('');
  };

  const close = (next: boolean): void => {
    onOpenChange(next);
    if (!next) reset();
  };

  const make = (): void => {
    create.mutate(
      { role, maxUses, expiresInDays: days, note: note.trim() || undefined },
      {
        onSuccess: (invite) => setMade(invite),
        onError: (error) => showErrorToast(error.message || "Couldn't make the link. Try again."),
      },
    );
  };

  const link = made ? inviteUrl({ path: made.path, siteUrl }) : '';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Link2 className="h-5 w-5" aria-hidden />
            {made ? 'Your invite link' : 'Invite people'}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-1">
          {made ? (
            <div className="space-y-3">
              <Label htmlFor="invite-link">Share this link</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={async () => setCopied(await copyText(link))}
                  aria-label="Copy the link"
                >
                  {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-sm text-npb-text-secondary">
                People who open it join as <span className="font-medium text-npb-text-primary">{SITE_ROLE_LABELS[made.role]}</span>.{' '}
                {describeInviteLimits(made)}
              </p>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-npb-text-primary">Role</legend>
                <div className="flex flex-wrap gap-2">
                  {roleChoices.map((choice) => (
                    <AiChoiceChip key={choice} isActive={role === choice} onClick={() => setRole(choice)}>
                      {SITE_ROLE_LABELS[choice]}
                    </AiChoiceChip>
                  ))}
                </div>
                <p className="text-sm text-npb-text-muted">{SITE_ROLE_DESCRIPTIONS[role]}</p>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-npb-text-primary">How many people can use it</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <AiChoiceChip isActive={places === 'one'} onClick={() => setPlaces('one')}>One person</AiChoiceChip>
                  <AiChoiceChip isActive={places === 'some'} onClick={() => setPlaces('some')}>Up to…</AiChoiceChip>
                  <AiChoiceChip isActive={places === 'unlimited'} onClick={() => setPlaces('unlimited')}>No limit</AiChoiceChip>
                </div>
                {places === 'some' ? (
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="invite-count" className="sr-only">Number of people</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="invite-count"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={INVITE_LIMITS.maxPlaces}
                        value={someCount}
                        onChange={(event) => setSomeCount(event.target.value)}
                        className="w-24"
                        aria-invalid={!countIsValid}
                        aria-describedby="invite-count-help"
                      />
                      <span className="text-sm text-npb-text-secondary">people</span>
                    </div>
                    <p id="invite-count-help" className={`text-sm ${countIsValid ? 'text-npb-text-muted' : 'text-npb-status-error'}`}>
                      {countIsValid ? 'The link stops working once this many have joined.' : `Enter a whole number from 1 to ${INVITE_LIMITS.maxPlaces}.`}
                    </p>
                  </div>
                ) : places === 'unlimited' ? (
                  <p className="text-sm text-npb-text-muted">Anyone with the link can join until it ends or you cancel it.</p>
                ) : null}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium text-npb-text-primary">Link ends after</legend>
                <div className="flex flex-wrap gap-2">
                  {END_CHOICES.map((choice) => (
                    <AiChoiceChip key={choice.label} isActive={days === choice.days} onClick={() => setDays(choice.days)}>
                      {choice.label}
                    </AiChoiceChip>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="invite-note">
                  Note <span className="font-normal text-npb-text-muted">(optional, only admins see it)</span>
                </Label>
                <Input
                  id="invite-note"
                  value={note}
                  maxLength={INVITE_LIMITS.noteLength}
                  placeholder="Who is it for?"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {made ? (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Make another
              </Button>
              <Button type="button" onClick={() => close(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={make} disabled={!canMake || create.isPending}>
                {create.isPending ? <Spinner className="mr-1.5 size-4" aria-hidden /> : null}
                {create.isPending ? 'Making link…' : 'Make link'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
