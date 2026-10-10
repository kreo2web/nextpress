import { useState, type JSX } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The one command to run on the server, with a copy button. */
export function CoreUpdateManualCommand({ command, label = 'Run this on your server:' }: { command: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn('[core-update] Could not copy the command', { atFunction: 'CoreUpdateManualCommand.copy', error });
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-sm text-npb-text-secondary">{label}</p>
      <div className="flex items-center gap-2 rounded-[var(--npb-radius-input)] bg-npb-surface-inset py-1 pl-3 pr-1">
        <Terminal className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
        <code className="min-w-0 flex-1 break-all py-1.5 font-mono text-xs text-npb-text-primary">{command}</code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2"
          onClick={() => void copy()}
          aria-label={copied ? 'Command copied' : 'Copy command'}
        >
          {copied ? <Check className="h-4 w-4 text-npb-status-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
