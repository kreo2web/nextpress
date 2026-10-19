import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsForStanding, type SiteAction, type SiteStanding } from '@shared/access';
import AdminSidebar from '@/components/AdminSidebar';

// What the signed-in person may do on the open site, set per test (the real hook asks the server).
const accessState = { standing: 'editor' as SiteStanding, isMainSiteAdmin: false };
vi.mock('@/hooks/use-site-access', () => ({
  useSiteAccess: () => ({
    access: null,
    isLoading: false,
    isMainSiteAdmin: accessState.isMainSiteAdmin,
    can: (action: SiteAction) =>
      actionsForStanding(accessState.isMainSiteAdmin ? 'owner' : accessState.standing).includes(action),
  }),
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    className,
    'aria-current': ariaCurrent,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    'aria-current'?: string;
  }) => {
    const ariaCurrentValue = ariaCurrent as "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean | undefined;
    return (
      <a href={href} className={className} aria-current={ariaCurrentValue}>
        {children}
      </a>
    ) as unknown as React.ReactElement;
  },
  useLocation: () => ['/admin/pages', vi.fn()],
}));

vi.mock('@/components/admin/WhatsNewSidebarBanner', () => ({
  WhatsNewSidebarBanner: () => null,
}));

describe('AdminSidebar', () => {
  beforeEach(() => {
    accessState.standing = 'editor';
    accessState.isMainSiteAdmin = false;
  });

  it('marks current navigation link for assistive technology', () => {
    render(<AdminSidebar />);

    expect(screen.getByRole('link', { name: 'Pages' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Posts' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  const visibleLinks = (): string[] => screen.getAllByRole('link').map((link) => link.textContent ?? '');

  it("shows an editor content tools, not the site's settings, people or plugins", () => {
    render(<AdminSidebar />);
    expect(visibleLinks()).toEqual(expect.arrayContaining(['Posts', 'Pages', 'Media', 'Comments']));
    expect(visibleLinks()).not.toEqual(expect.arrayContaining(['Settings']));
    expect(visibleLinks()).not.toContain('People');
    expect(visibleLinks()).not.toContain('Plugins');
    expect(visibleLinks()).not.toContain('Themes');
  });

  it("shows a site admin their site's settings and people, but plugins only to main-site admins", () => {
    accessState.standing = 'admin';
    const { unmount } = render(<AdminSidebar />);
    expect(visibleLinks()).toEqual(expect.arrayContaining(['Settings', 'People', 'Themes']));
    expect(visibleLinks()).not.toContain('Plugins');
    unmount();

    accessState.isMainSiteAdmin = true;
    render(<AdminSidebar />);
    expect(visibleLinks()).toContain('Plugins');
  });
});
