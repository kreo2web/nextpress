import { useState } from 'react';
import { Sun, Moon, ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiteSwitcher } from '@/components/SiteSwitcher';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import { authClient } from '@/lib/auth-client';

export default function AdminTopBar() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error({ atFunction: 'AdminTopBar.signOut', data: { error }, message: 'Sign-out failed; leaving anyway' });
    }
    window.location.href = '/';
  };

  return (
    <div className="admin-top-bar fixed top-0 left-0 right-0 z-50 flex h-8 items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold text-white">NextPress</div>
        <SiteSwitcher />
      </div>
      <div className="flex items-center gap-3">
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
              className="h-7 gap-1 px-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              {user?.firstName || user?.username || 'Admin'}
              <ChevronDown className="h-3 w-3" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" aria-hidden />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
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
