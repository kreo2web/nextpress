import { useState } from 'react';
import { CircleAlert, CircleCheck, PlugZap } from 'lucide-react';
import { AI_ASSISTANT_MESSAGES, type AiConnectionTestResult } from '@shared/ai-builder';
import { testAiConnection } from '@/hooks/use-ai-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

/**
 * Checks the saved settings with one tiny call that must use a tool, so a model that can only chat
 * is found out here rather than in the editor. Tests what is saved, not what is typed in the form.
 */
export function AiConnectionTest({ siteId }: { siteId: string }) {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<AiConnectionTestResult | null>(null);

  const runTest = async () => {
    setIsTesting(true);
    setResult(null);
    setResult(await testAiConnection({ siteId }));
    setIsTesting(false);
  };

  return (
    <Card className="admin-surface">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-npb-text-primary">
            <PlugZap className="h-4 w-4 text-npb-text-muted" aria-hidden />
            Check the saved settings
          </p>
          <div role="status" aria-live="polite">
            {result?.ok ? (
              <p className="flex items-center gap-1.5 text-sm text-npb-status-success">
                <CircleCheck className="h-4 w-4 shrink-0" aria-hidden />
                {AI_ASSISTANT_MESSAGES.testOk}
              </p>
            ) : result ? (
              <p className="flex items-center gap-1.5 text-sm text-npb-status-error">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                {result.message}
              </p>
            ) : (
              <p className="text-sm text-npb-text-muted">Makes one small request to your AI service.</p>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" className="shrink-0" disabled={isTesting} onClick={() => void runTest()}>
          {isTesting ? <Spinner className="size-4" aria-hidden /> : null}
          {isTesting ? 'Testing…' : 'Test connection'}
        </Button>
      </CardContent>
    </Card>
  );
}
