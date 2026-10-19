import { useState, type JSX } from 'react';
import { Ban, Check, Copy, Link2 } from 'lucide-react';
import { SITE_ROLE_LABELS } from '@shared/access';
import type { InviteSummary } from '@shared/invites';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { showErrorToast, showSuccessToast } from '@/lib/sonner-toast';
import { copyText } from './invite-dialog';
import { INVITE_STATE_LABELS, describeInviteLimits } from './invite-words';
import { inviteUrl, useInviteLinks } from './use-people';

type InviteLinksSectionProps = { siteId: string; siteUrl: string | null | undefined };

/** The site's invite links: open ones first, with copy and cancel; closed ones listed quietly below. */
export function InviteLinksSection({ siteId, siteUrl }: InviteLinksSectionProps): JSX.Element {
  const { list, cancel } = useInviteLinks(siteId);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<InviteSummary | null>(null);

  const copy = async (invite: InviteSummary): Promise<void> => {
    const ok = await copyText(inviteUrl({ path: invite.path, siteUrl }));
    if (!ok) {
      showErrorToast("This browser didn't allow copying. Open the link list again and copy it by hand.");
      return;
    }
    setCopiedId(invite.id);
    window.setTimeout(() => setCopiedId((current) => (current === invite.id ? null : current)), 2000);
  };

  const confirmCancel = (): void => {
    if (!cancelling) return;
    cancel.mutate(
      { inviteId: cancelling.id },
      {
        onSuccess: () => {
          showSuccessToast('Link cancelled. It no longer works.');
          setCancelling(null);
        },
        onError: (error) => showErrorToast(error.message || "Couldn't cancel the link. Try again."),
      },
    );
  };

  if (list.isLoading) return <Skeleton className="h-16 w-full" />;
  if (list.isError) {
    return (
      <p className="text-sm text-npb-text-secondary">
        Invite links couldn't be loaded.{' '}
        <Button variant="link" className="h-auto px-1 py-0" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </p>
    );
  }

  const invites = list.data?.invites ?? [];
  const open = invites.filter((invite) => invite.state === 'open');
  const closed = invites.filter((invite) => invite.state !== 'open').slice(0, 5);
  if (invites.length === 0) {
    return <p className="text-sm text-npb-text-muted">No invite links yet. Use “Invite people” to make one.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-npb-divider" aria-label="Invite links">
        {[...open, ...closed].map((invite) => {
          const isOpen = invite.state === 'open';
          return (
            <li key={invite.id} className={`flex flex-wrap items-center gap-3 py-3 ${isOpen ? '' : 'opacity-60'}`}>
              <Link2 className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-npb-text-primary">
                  {SITE_ROLE_LABELS[invite.role]}
                  {invite.note ? <span className="font-normal text-npb-text-secondary"> · {invite.note}</span> : null}
                </p>
                <p className="text-sm text-npb-text-muted">
                  {isOpen ? describeInviteLimits(invite) : `Used by ${invite.uses} ${invite.uses === 1 ? 'person' : 'people'}.`}
                </p>
              </div>
              {isOpen ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copy(invite)}>
                    {copiedId === invite.id ? <Check className="mr-1.5 h-4 w-4" aria-hidden /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden />}
                    {copiedId === invite.id ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-npb-text-muted hover:text-npb-status-error"
                    aria-label="Cancel this link"
                    onClick={() => setCancelling(invite)}
                  >
                    <Ban className="h-4 w-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="border-0 bg-npb-surface-inset font-normal text-npb-text-secondary">
                  {INVITE_STATE_LABELS[invite.state]}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={cancelling !== null} onOpenChange={(next) => !next && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this invite link?</AlertDialogTitle>
            <AlertDialogDescription>Nobody new can join with it. People who already joined keep their role.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmCancel();
              }}
              disabled={cancel.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancel.isPending ? <Spinner className="size-4" aria-hidden /> : null}
              {cancel.isPending ? 'Cancelling…' : 'Cancel link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
