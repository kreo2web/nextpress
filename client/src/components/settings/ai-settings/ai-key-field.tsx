import { useState, type ReactNode, type Ref } from 'react';
import { Eye, EyeOff, KeyRound, TriangleAlert } from 'lucide-react';
import { AI_SETTINGS_LIMITS, AI_SETTINGS_MESSAGES, type AiProviderId } from '@shared/ai-builder';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { SettingsLabel } from '@/components/PageBuilder/shared/settings-label';
import { AiFieldError } from './ai-field-error';
import { KEY_PLACEHOLDERS, looksLocalAddress, type KeyArea } from './ai-settings-rules';

type AiKeyFieldProps = {
  area: KeyArea;
  provider: AiProviderId;
  baseUrl: string;
  value: string;
  onChange: (key: string) => void;
  onReplace: () => void;
  onCancel: () => void;
  error?: string;
  inputRef: Ref<HTMLInputElement>;
};

const INPUT_ID = 'ai-key';
const HELP_ID = 'ai-key-help';
const NOTE_ID = 'ai-key-note';
const ERROR_ID = 'ai-key-error';

/** The line under the key box, only where it helps; null when there is nothing worth saying. */
const readHelp = ({ area, provider, baseUrl }: Pick<AiKeyFieldProps, 'area' | 'provider' | 'baseUrl'>): string | null => {
  if (area.mode === 'input' && area.reason === 'changed') return AI_SETTINGS_MESSAGES.keyNeededAfterChange;
  if (provider === 'openai-compatible' && looksLocalAddress(baseUrl)) {
    return 'Leave empty if your local service needs no key.';
  }
  return null;
};

type KeyRowProps = { children: ReactNode; actionLabel: string; onAction: () => void };

/** A saved-state row: a sentence and one action, on a quiet band. */
function KeyRow({ children, actionLabel, onAction }: KeyRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--npb-radius-input)] bg-npb-surface-inset px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2 text-sm text-npb-text-primary">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
        <p>{children}</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0 max-md:h-10" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

/**
 * The key. It is never filled in: a saved key shows only how it ends, and a new one is typed into an
 * empty box. Show/hide changes only how the box displays what was typed.
 */
export function AiKeyField({
  area,
  provider,
  baseUrl,
  value,
  onChange,
  onReplace,
  onCancel,
  error,
  inputRef,
}: AiKeyFieldProps) {
  const [isShown, setIsShown] = useState(false);
  const help = readHelp({ area, provider, baseUrl });
  const isUnreadable = area.mode === 'input' && area.reason === 'unreadable';
  const canCancel = area.mode === 'input' && (area.reason === 'replace' || area.reason === 'add');
  const describedBy = [help ? HELP_ID : null, isUnreadable ? NOTE_ID : null, error ? ERROR_ID : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-2">
      <SettingsLabel htmlFor={area.mode === 'input' ? INPUT_ID : undefined}>Key</SettingsLabel>

      {area.mode === 'saved' ? (
        <KeyRow actionLabel="Replace" onAction={onReplace}>
          {`Key saved, ends in …${area.ending}`}
        </KeyRow>
      ) : null}

      {area.mode === 'none' ? (
        <KeyRow actionLabel="Add a key" onAction={onReplace}>
          No key saved. That's fine for a service on this computer.
        </KeyRow>
      ) : null}

      {area.mode === 'input' ? (
        <>
          {isUnreadable ? (
            <p
              id={NOTE_ID}
              className="flex items-start gap-2 rounded-[var(--npb-radius-input)] bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              The saved key can no longer be read. Enter it again.
            </p>
          ) : null}
          <div className="flex items-start gap-2">
            <InputGroup className="h-11 md:h-9">
              <InputGroupInput
                id={INPUT_ID}
                ref={inputRef}
                type={isShown ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={KEY_PLACEHOLDERS[provider]}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={canCancel}
                maxLength={AI_SETTINGS_LIMITS.apiKey}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy || undefined}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label={isShown ? 'Hide key' : 'Show key'}
                  aria-pressed={isShown}
                  onClick={() => setIsShown((current) => !current)}
                >
                  {isShown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {canCancel ? (
              <Button type="button" variant="ghost" className="shrink-0" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
          {help ? (
            <p id={HELP_ID} className="text-sm text-npb-text-muted">
              {help}
            </p>
          ) : null}
        </>
      ) : null}

      <AiFieldError id={ERROR_ID} message={error} />
    </div>
  );
}
