import type { InviteState, InviteSummary } from '@shared/invites';

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const INVITE_STATE_LABELS: Record<InviteState, string> = {
  open: 'Open',
  full: 'No places left',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

const placesWords = (placesLeft: number | null): string => {
  if (placesLeft === null) return 'Anyone with the link can join';
  if (placesLeft === 0) return 'No places left';
  return placesLeft === 1 ? '1 place left' : `${placesLeft} places left`;
};

/** "3 places left, ends Oct 26, 2026." in plain words, for the link list and the dialog. */
export const describeInviteLimits = (invite: Pick<InviteSummary, 'placesLeft' | 'expiresAt'>): string => {
  const ends = invite.expiresAt ? `ends ${dayFormat.format(new Date(invite.expiresAt))}` : 'never ends';
  return `${placesWords(invite.placesLeft)}, ${ends}.`;
};
