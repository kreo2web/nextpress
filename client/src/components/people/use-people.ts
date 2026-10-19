import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SitePerson, SiteRoleName } from '@shared/access';
import type { CreateInviteInput, InviteSummary } from '@shared/invites';
import type { User } from '@shared/schema-types';
import { apiRequest } from '@/lib/queryClient';

const peopleKey = (siteId: string) => ['/api/site-people', { siteId }] as const;
const invitesKey = (siteId: string) => ['/api/invites', { siteId }] as const;
const EVERYONE_KEY = ['/api/users', 'everyone'] as const;

const getJson = async <T,>(url: string): Promise<T> => {
  const response = await apiRequest('GET', url);
  return (await response.json()) as T;
};

/** One site's people and their roles, with role changes and removal. */
export function useSitePeople(siteId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: peopleKey(siteId) });

  const list = useQuery({
    queryKey: peopleKey(siteId),
    queryFn: () => getJson<{ people: SitePerson[] }>(`/api/site-people?siteId=${encodeURIComponent(siteId)}`),
    enabled: siteId !== '',
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: SiteRoleName }) =>
      apiRequest('PUT', `/api/site-people/${userId}`, { siteId, role }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiRequest('DELETE', `/api/site-people/${userId}?siteId=${encodeURIComponent(siteId)}`),
    onSuccess: refresh,
  });

  return { list, changeRole, remove };
}

/** A site's invite links, with making and cancelling them. */
export function useInviteLinks(siteId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: invitesKey(siteId) });

  const list = useQuery({
    queryKey: invitesKey(siteId),
    queryFn: () => getJson<{ invites: InviteSummary[] }>(`/api/invites?siteId=${encodeURIComponent(siteId)}`),
    enabled: siteId !== '',
  });

  const create = useMutation({
    mutationFn: async (input: Omit<CreateInviteInput, 'siteId'>): Promise<InviteSummary> =>
      (await (await apiRequest('POST', '/api/invites', { ...input, siteId })).json()) as InviteSummary,
    onSuccess: refresh,
  });

  const cancel = useMutation({
    mutationFn: ({ inviteId }: { inviteId: string }) => apiRequest('DELETE', `/api/invites/${inviteId}`),
    onSuccess: refresh,
  });

  return { list, create, cancel };
}

export type NewAccountInput = { name: string; email: string; username: string; password: string; siteId?: string; role?: SiteRoleName };

/** Every account on the install (main-site admins only). */
export function useEveryone({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: EVERYONE_KEY });

  const list = useQuery({
    queryKey: EVERYONE_KEY,
    queryFn: () => getJson<{ users: User[]; total: number }>('/api/users?per_page=100'),
    enabled,
  });

  const add = useMutation({
    mutationFn: (input: NewAccountInput) => apiRequest('POST', '/api/users', input),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: ({ userId }: { userId: string }) => apiRequest('DELETE', `/api/users/${userId}`),
    onSuccess: refresh,
  });

  return { list, add, remove };
}

/** The full link to share: the site's own address when it has one, else this dashboard's. */
export const inviteUrl = ({ path, siteUrl }: { path: string; siteUrl: string | null | undefined }): string =>
  `${(siteUrl || window.location.origin).replace(/\/+$/, '')}${path}`;
