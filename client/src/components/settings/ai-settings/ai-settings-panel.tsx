import { AI_SETTINGS_MESSAGES, type AiSettingsView } from '@shared/ai-builder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { readServerMessage, useAiSettings } from '@/hooks/use-ai-settings';
import { useActiveSite } from '@/hooks/useActiveSite';
import { AiConnectionTest } from './ai-connection-test';
import { AiSettingsForm } from './ai-settings-form';
import { AiSettingsReadonly } from './ai-settings-readonly';
import { AiSettingsSkeleton } from './ai-settings-skeleton';

type LoadProblemProps = {
  message: string;
  onRetry: () => void;
};

function AiLoadProblem({ message, onRetry }: LoadProblemProps) {
  return (
    <Card className="admin-surface">
      <CardContent className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-npb-text-secondary">
          {message}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Settings → AI. Decides what to show: placeholders while loading, a calm note for people who can't
 * manage the settings, otherwise the form.
 */
export function AiSettingsPanel() {
  const { activeSiteId } = useActiveSite();
  const { statusQuery, settingsQuery, saveSettings, isSaving, removeSettings, isRemoving } = useAiSettings({
    siteId: activeSiteId,
  });

  if (!statusQuery.data) {
    if (!statusQuery.isError) return <AiSettingsSkeleton />;
    return (
      <AiLoadProblem
        message={readServerMessage({ error: statusQuery.error, fallback: AI_SETTINGS_MESSAGES.loadFailed })}
        onRetry={() => void statusQuery.refetch()}
      />
    );
  }
  if (!statusQuery.data.canManage) return <AiSettingsReadonly isEnabled={statusQuery.data.enabled} />;

  if (!settingsQuery.data) {
    if (!settingsQuery.isError) return <AiSettingsSkeleton />;
    return (
      <AiLoadProblem
        message={readServerMessage({ error: settingsQuery.error, fallback: AI_SETTINGS_MESSAGES.loadFailed })}
        onRetry={() => void settingsQuery.refetch()}
      />
    );
  }

  const saved: AiSettingsView | null = settingsQuery.data.configured ? settingsQuery.data : null;

  return (
    <div className="space-y-6">
      <AiSettingsForm
        key={saved ? saved.updatedAt : 'empty'}
        saved={saved}
        onSave={saveSettings}
        isSaving={isSaving}
        onRemove={removeSettings}
        isRemoving={isRemoving}
      />
      {saved && !saved.keyUnreadable ? <AiConnectionTest key={`test-${saved.updatedAt}`} siteId={activeSiteId} /> : null}
    </div>
  );
}
