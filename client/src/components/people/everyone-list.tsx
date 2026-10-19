import { useState, type JSX } from 'react';
import { Trash2, Users } from 'lucide-react';
import type { User } from '@shared/schema-types';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showErrorToast, showSuccessToast } from '@/lib/sonner-toast';
import { useEveryone } from './use-people';

const joined = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Every account on the install, for main-site admins. Roles are given per site, on the site tab. */
export function EveryoneList({ meId }: { meId: string | undefined }): JSX.Element {
  const { list, remove } = useEveryone({ enabled: true });
  const [removing, setRemoving] = useState<User | null>(null);

  const confirmRemove = (): void => {
    if (!removing) return;
    remove.mutate(
      { userId: removing.id },
      {
        onSuccess: () => {
          showSuccessToast(`${removing.name ?? removing.username}'s account was removed`);
          setRemoving(null);
        },
        onError: (error) => {
          showErrorToast(error.message || "Couldn't remove the account. Try again.");
          setRemoving(null);
        },
      },
    );
  };

  if (list.isLoading) return <Skeleton className="h-40 w-full" />;
  if (list.isError) {
    return (
      <p className="py-10 text-center text-npb-text-secondary">
        Accounts couldn't be loaded.{' '}
        <Button variant="link" className="px-1" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </p>
    );
  }

  const users = list.data?.users ?? [];
  if (users.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-npb-text-secondary">
        <Users className="h-4 w-4" aria-hidden />
        No accounts yet.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead className="hidden md:table-cell">Joined</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <p className="font-medium text-npb-text-primary">{user.name ?? user.username}</p>
                <p className="text-sm text-npb-text-muted">@{user.username}</p>
              </TableCell>
              <TableCell className="hidden text-npb-text-secondary sm:table-cell">{user.email}</TableCell>
              <TableCell className="hidden text-npb-text-secondary md:table-cell">
                {user.createdAt ? joined.format(new Date(user.createdAt)) : '—'}
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-npb-text-muted hover:text-npb-status-error"
                  disabled={user.id === meId}
                  title={user.id === meId ? "You can't remove your own account" : undefined}
                  aria-label={user.id === meId ? "You can't remove your own account" : `Remove ${user.name ?? user.username}'s account`}
                  onClick={() => setRemoving(user)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name ?? removing?.username}'s account?</AlertDialogTitle>
            <AlertDialogDescription>
              They can't sign in any more and lose every role. Someone who still owns pages, posts or a site can't be removed;
              take away their roles instead.
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
              {remove.isPending ? 'Removing…' : 'Remove account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
