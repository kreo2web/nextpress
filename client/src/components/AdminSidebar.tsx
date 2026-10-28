import { Link, useLocation } from 'wouter';
import {
  Gauge,
  BookOpen,
  FileText,
  File,
  Image,
  MessageCircle,
  Inbox,
  Paintbrush,
  Globe,
  LayoutPanelTop,
  Plug,
  Users,
  Cog,
  Download,
  UserRound,
} from 'lucide-react';
import type { SiteAction } from '@shared/access';
import { NEXTPRESS_CONFIG } from '../../../config';
import { WhatsNewSidebarBanner } from '@/components/admin/WhatsNewSidebarBanner';
import { useSiteAccess, type SiteAccessState } from '@/hooks/use-site-access';

type MenuItem = {
  label: string;
  path: string;
  icon: typeof Gauge;
  section?: string;
  /** What the person needs on the active site to use the page; none = everyone with dashboard access. */
  needs?: SiteAction | 'main-site-admin';
};

const menuItems: MenuItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: Gauge },
  { label: 'Posts', path: '/admin/posts', icon: FileText, section: 'Content', needs: 'edit_content' },
  { label: 'Pages', path: '/admin/pages', icon: File, section: 'Content', needs: 'edit_content' },
  { label: 'Docs', path: '/admin/docs', icon: BookOpen, section: 'Content', needs: 'edit_content' },
  { label: 'Media', path: '/admin/media', icon: Image, section: 'Content', needs: 'edit_content' },
  { label: 'Comments', path: '/admin/comments', icon: MessageCircle, section: 'Content', needs: 'moderate_comments' },
  { label: 'Forms', path: '/admin/forms', icon: Inbox, section: 'Content', needs: 'edit_content' },
  { label: 'Themes', path: '/admin/themes', icon: Paintbrush, section: 'Appearance', needs: 'manage_site' },
  { label: 'Templates', path: '/admin/templates', icon: LayoutPanelTop, section: 'Appearance', needs: 'edit_content' },
  { label: 'Import WordPress', path: '/admin/import/wordpress', icon: Download, section: 'Tools', needs: 'edit_content' },
  { label: 'Plugins', path: '/admin/plugins', icon: Plug, section: 'System', needs: 'main-site-admin' },
  { label: 'Sites', path: '/admin/sites', icon: Globe, section: 'System', needs: 'manage_site' },
  { label: 'People', path: '/admin/users', icon: Users, section: 'System', needs: 'manage_people' },
  { label: 'Your account', path: '/admin/account', icon: UserRound, section: 'System' },
  { label: 'Settings', path: '/admin/settings', icon: Cog, section: 'System', needs: 'manage_site' },
];

/** The server refuses anything a person can't do; this only keeps the menu to what will work. */
const canOpen = ({ item, access }: { item: MenuItem; access: SiteAccessState }): boolean => {
  if (!item.needs) return true;
  if (item.needs === 'main-site-admin') return access.isMainSiteAdmin;
  return access.can(item.needs);
};

export default function AdminSidebar() {
  const [location] = useLocation();
  const access = useSiteAccess();

  const groupedItems = menuItems.filter((item) => canOpen({ item, access })).reduce(
    (acc, item) => {
      if (!item.section) {
        acc.main = acc.main ?? [];
        acc.main.push(item);
      } else {
        acc[item.section] = acc[item.section] ?? [];
        acc[item.section].push(item);
      }
      return acc;
    },
    {} as Record<string, MenuItem[]>
  );

  return (
    <div className="admin-sidebar fixed left-0 top-8 bottom-0 z-40 w-40 overflow-hidden">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 overflow-y-auto pt-3" aria-label="Admin">
          {groupedItems.main?.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.path ||
              (item.path === '/admin/dashboard' && location === '/admin');

            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`admin-sidebar-link ${isActive ? 'admin-sidebar-link-active' : ''}`}
              >
                <Icon className="mr-3 h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {Object.entries(groupedItems)
            .filter(([key]) => key !== 'main')
            .map(([section, items]) => (
              <div key={section} className="px-4 py-2" role="group" aria-label={section}>
                <div className="admin-sidebar-section-label" aria-hidden="true">
                  {section}
                </div>
                <div className="ml-2 space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        aria-current={isActive ? 'page' : undefined}
                        className={`admin-sidebar-link admin-sidebar-link-sub ${
                          isActive ? 'admin-sidebar-link-active' : ''
                        }`}
                      >
                        <Icon className="mr-3 h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </nav>

        <WhatsNewSidebarBanner />

        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/60">
          v{NEXTPRESS_CONFIG.version}
        </div>
      </div>
    </div>
  );
}
