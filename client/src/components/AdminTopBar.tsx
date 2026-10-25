import { useState } from 'react';
import { useLocation } from 'wouter';
import { Sun, Moon, ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiteSwitcher } from '@/components/SiteSwitcher';
import { NewContentButton } from '@/components/new-content';
import { useSiteAccess } from '@/hooks/use-site-access';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import { getAccountInitials } from '@/components/account/use-account-profile';
import { signOutAndLeave } from '@/components/account/sign-out';

export default function AdminTopBar() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Making content needs the same right as the Pages and Posts screens; the server checks it again.
  const canMakeContent = useSiteAccess().can('edit_content');

  return (
    <div className="admin-top-bar fixed top-0 left-0 right-0 z-50 flex h-8 items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold text-white">NextPress</div>
        <SiteSwitcher />
      </div>
      <div className="flex items-center gap-3">
        {canMakeContent ? <NewContentButton variant="chrome" /> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-7 w-7 p-0 text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <Avatar className="size-5">
                <AvatarFallback className="bg-white/15 text-[9px] font-semibold text-white">
                  {getAccountInitials({ firstName: user?.firstName, lastName: user?.lastName, username: user?.username })}
                </AvatarFallback>
              </Avatar>
              {user?.firstName || user?.username || 'Admin'}
              <ChevronDown className="h-3 w-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuItem onSelect={() => setLocation('/admin/account')}>
              <UserRound className="mr-2 h-4 w-4" aria-hidden />
              Your account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" aria-hidden />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOutAndLeave({ atFunction: 'AdminTopBar.signOut', userId: user?.id })}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Next to the menu, not inside it: closing the menu must not close the dialog. */}
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
