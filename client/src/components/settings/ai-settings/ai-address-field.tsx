import type { Ref } from 'react';
import { AI_ADDRESS_PRESETS, AI_SETTINGS_LIMITS } from '@shared/ai-builder';
import { Input } from '@/components/ui/input';
import { SettingsLabel } from '@/components/PageBuilder/shared/settings-label';
import { AiChoiceChip } from './ai-choice-chip';
import { AiFieldError } from './ai-field-error';
import { isSameAddress } from './ai-settings-rules';

type AiAddressFieldProps = {
  value: string;
  onChange: (address: string) => void;
  error?: string;
  inputRef: Ref<HTMLInputElement>;
};

const INPUT_ID = 'ai-address';
const HELP_ID = 'ai-address-help';
const ERROR_ID = 'ai-address-error';

/** Where the service answers. Only the generic OpenAI-compatible choice asks for it. */
export function AiAddressField({ value, onChange, error, inputRef }: AiAddressFieldProps) {
  return (
    <div className="space-y-2">
      <SettingsLabel htmlFor={INPUT_ID}>Address</SettingsLabel>
      <Input
        id={INPUT_ID}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.com/v1"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={AI_SETTINGS_LIMITS.baseUrl}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${HELP_ID} ${ERROR_ID}` : HELP_ID}
      />
      <div role="group" aria-label="Start from an address" className="flex flex-wrap gap-2">
        {AI_ADDRESS_PRESETS.map((preset) => (
          <AiChoiceChip
            key={preset.id}
            isActive={isSameAddress({ a: value, b: preset.baseUrl })}
            onClick={() => onChange(preset.baseUrl)}
          >
            {preset.label}
            {preset.isLocal ? (
              <span className="rounded-sm bg-npb-surface-inset px-1.5 py-0.5 text-xs font-normal text-npb-text-muted">
                On this computer
              </span>
            ) : null}
          </AiChoiceChip>
        ))}
      </div>
      <p id={HELP_ID} className="text-sm text-npb-text-muted">
        Pick a starting point or paste the address your AI service gave you.
      </p>
      <AiFieldError id={ERROR_ID} message={error} />
    </div>
  );
}
