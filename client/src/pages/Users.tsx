import { useState, type JSX } from 'react';
import { Link2, UserPlus } from 'lucide-react';
import type { SiteStanding } from '@shared/access';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddAccountDialog } from '@/components/people/add-account-dialog';
import { EveryoneList } from '@/components/people/everyone-list';
import { InviteDialog } from '@/components/people/invite-dialog';
import { InviteLinksSection } from '@/components/people/invite-links-section';
import { SitePeopleList } from '@/components/people/site-people-list';
import { useActiveSite } from '@/hooks/useActiveSite';
import { useAuth } from '@/hooks/useAuth';
import { useSiteAccess } from '@/hooks/use-site-access';

/**
 * People: who has which role on the open site and the invite links that bring new people in.
 * Main-site admins also see every account on the install.
 */
export default function PeoplePage(): JSX.Element {
  const { activeSiteId, activeSite, formatSiteLabel } = useActiveSite();
  const { user } = useAuth();
  const access = useSiteAccess();
  const [inviting, setInviting] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [tab, setTab] = useState<'site' | 'everyone'>('site');

  const meId = (user as { id?: string } | undefined)?.id;
  const siteName = activeSite ? formatSiteLabel(activeSite) : 'this site';
  // Main-site admins act as owners everywhere.
  const myStanding: SiteStanding | null = access.isMainSiteAdmin ? 'owner' : (access.access?.standing ?? null);
  const canManage = access.can('manage_people');

  if (!access.isLoading && !canManage) {
    return (
      <AdminLayout title="People">
        <Card className="admin-surface">
          <CardContent className="py-12 text-center text-npb-text-secondary">
            Only this site's admins manage its people. Switch to a site you run, or ask its admin.
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="People"
      actions={
        tab === 'everyone' ? (
          <Button onClick={() => setAddingAccount(true)}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            Add account
          </Button>
        ) : (
          <Button onClick={() => setInviting(true)} disabled={!canManage}>
            <Link2 className="mr-2 h-4 w-4" aria-hidden />
            Invite people
          </Button>
        )
      }
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'site' | 'everyone')} className="space-y-4">
        {access.isMainSiteAdmin ? (
          <TabsList>
            <TabsTrigger value="site">{siteName}</TabsTrigger>
            <TabsTrigger value="everyone">Everyone</TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="site" className="mt-0 space-y-4">
          <Card className="admin-surface gap-0 py-2">
            <CardContent className="pb-2">
              <SitePeopleList siteId={activeSiteId} meId={meId} myStanding={myStanding} />
            </CardContent>
          </Card>
          <Card className="admin-surface gap-0 overflow-hidden py-0">
            <div className="bg-npb-surface-header px-6 py-3">
              <h2 className="text-sm font-semibold text-npb-text-primary">Invite links</h2>
            </div>
            <CardContent className="py-2">
              <InviteLinksSection siteId={activeSiteId} siteUrl={activeSite?.siteUrl} />
            </CardContent>
          </Card>
        </TabsContent>

        {access.isMainSiteAdmin ? (
          <TabsContent value="everyone" className="mt-0">
            <Card className="admin-surface gap-0 py-2">
              <CardContent>
                <EveryoneList meId={meId} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        siteId={activeSiteId}
        siteUrl={activeSite?.siteUrl}
        myStanding={myStanding}
      />
      {access.isMainSiteAdmin ? (
        <AddAccountDialog open={addingAccount} onOpenChange={setAddingAccount} siteId={activeSiteId} siteName={siteName} />
      ) : null}
    </AdminLayout>
  );
}
