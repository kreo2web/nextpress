import { useState, type JSX } from 'react';
import { UserMinus, Users } from 'lucide-react';
import {
  SITE_ROLES,
  SITE_ROLE_DESCRIPTIONS,
  SITE_ROLE_LABELS,
  isAtLeast,
  type SitePerson,
  type SiteRoleName,
  type SiteStanding,
} from '@shared/access';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showErrorToast, showSuccessToast } from '@/lib/sonner-toast';
import { RoleBadge } from './role-badge';
import { useSitePeople } from './use-people';

type SitePeopleListProps = {
  siteId: string;
  /** The signed-in person: they can't change their own role. */
  meId: string | undefined;
  /** What the signed-in person is on this site ("owner" for main-site admins). */
  myStanding: SiteStanding | null;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Why a row's role is locked, or null when the signed-in person may change it. */
const lockReason = ({
  person,
  meId,
  myStanding,
}: {
  person: SitePerson;
  meId?: string;
  myStanding: SiteStanding | null;
}): string | null => {
  if (person.standing === 'owner') return "The site's owner always has full access.";
  if (person.userId === meId) return "You can't change your own role.";
  if (!isAtLeast({ a: myStanding, b: person.standing })) return 'This person has a higher role than you.';
  return null;
};

/** Everyone with a role on the site: change it in place, or take them off the site. */
export function SitePeopleList({ siteId, meId, myStanding }: SitePeopleListProps): JSX.Element {
  const { list, changeRole, remove } = useSitePeople(siteId);
  const [removing, setRemoving] = useState<SitePerson | null>(null);
  const roleChoices = SITE_ROLES.filter((role) => isAtLeast({ a: myStanding, b: role }));

  const saveRole = (person: SitePerson, role: SiteRoleName): void => {
    changeRole.mutate(
      { userId: person.userId, role },
      {
        onSuccess: () => showSuccessToast(`${person.name}'s role is now ${SITE_ROLE_LABELS[role]}`),
        onError: (error) => showErrorToast(error.message || "Couldn't change the role. Try again."),
      },
    );
  };

  const confirmRemove = (): void => {
    if (!removing) return;
    remove.mutate(
      { userId: removing.userId },
      {
        onSuccess: () => {
          showSuccessToast(`${removing.name} was taken off this site`);
          setRemoving(null);
        },
        onError: (error) => showErrorToast(error.message || "Couldn't take them off the site. Try again."),
      },
    );
  };

  if (list.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (list.isError) {
    return (
      <p className="py-10 text-center text-npb-text-secondary">
        People couldn't be loaded.{' '}
        <Button variant="link" className="px-1" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </p>
    );
  }

  const people = list.data?.people ?? [];
  if (people.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-npb-text-secondary">
        <Users className="h-4 w-4" aria-hidden />
        Nobody has a role here yet. Invite someone to get started.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-npb-divider" aria-label="People on this site">
        {people.map((person) => {
          const locked = lockReason({ person, meId, myStanding });
          return (
            <li key={person.userId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar className="h-9 w-9">
                {person.profileImageUrl ? <AvatarImage src={person.profileImageUrl} alt="" /> : null}
                <AvatarFallback>{initials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-npb-text-primary">
                  {person.name}
                  {person.userId === meId ? <span className="ml-1.5 text-sm font-normal text-npb-text-muted">(you)</span> : null}
                </p>
                <p className="truncate text-sm text-npb-text-muted">{person.email ?? `@${person.username}`}</p>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                {locked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <RoleBadge standing={person.standing} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{locked}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Select
                    value={person.standing}
                    onValueChange={(value) => saveRole(person, value as SiteRoleName)}
                    disabled={changeRole.isPending}
                  >
                    <SelectTrigger className="w-[9.5rem]" aria-label={`Role for ${person.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleChoices.map((role) => (
                        <SelectItem key={role} value={role}>
                          {SITE_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-npb-text-muted hover:text-npb-status-error"
                  aria-label={locked ? `${person.name} can't be taken off: ${locked}` : `Take ${person.name} off this site`}
                  disabled={Boolean(locked)}
                  title={locked ?? undefined}
                  onClick={() => setRemoving(person)}
                >
                  <UserMinus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-npb-divider pt-3 text-sm text-npb-text-muted">
        <span className="font-medium text-npb-text-secondary">{SITE_ROLE_LABELS.editor}:</span> {SITE_ROLE_DESCRIPTIONS.editor}{' '}
        <span className="font-medium text-npb-text-secondary">{SITE_ROLE_LABELS.admin}:</span> {SITE_ROLE_DESCRIPTIONS.admin}{' '}
        <span className="font-medium text-npb-text-secondary">{SITE_ROLE_LABELS.subscriber}:</span> {SITE_ROLE_DESCRIPTIONS.subscriber}
      </p>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take {removing?.name} off this site?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose their role here at once. Their account and what they wrote stay. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmRemove();
              }}
              disabled={remove.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {remove.isPending ? <Spinner className="size-4" aria-hidden /> : null}
              {remove.isPending ? 'Removing…' : 'Take off site'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
