import { useQuery } from '@tanstack/react-query';
import type { SiteAccess, SiteAction } from '@shared/access';
import { useOptionalActiveSite } from '@/hooks/useActiveSite';

export type SiteAccessState = {
  access: SiteAccess | null;
  isLoading: boolean;
  /** True when the signed-in person may do `action` on the active site. False while loading. */
  can: (action: SiteAction) => boolean;
  isMainSiteAdmin: boolean;
};

/**
 * What the signed-in person may do on the active site, for hiding what they can't use.
 * The server checks every action again; this only keeps the dashboard honest.
 */
export function useSiteAccess(): SiteAccessState {
  const siteId = useOptionalActiveSite()?.activeSiteId ?? '';
  const query = useQuery<SiteAccess>({
    queryKey: ['/api/access', { siteId }],
    queryFn: async () => {
      const response = await fetch(`/api/access?siteId=${encodeURIComponent(siteId)}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`Could not load access (${response.status})`);
      return (await response.json()) as SiteAccess;
    },
    enabled: siteId !== '',
    staleTime: 60_000,
  });

  const access = query.data ?? null;
  return {
    access,
    isLoading: query.isLoading,
    can: (action) => access?.actions.includes(action) ?? false,
    isMainSiteAdmin: access?.isMainSiteAdmin ?? false,
  };
}
