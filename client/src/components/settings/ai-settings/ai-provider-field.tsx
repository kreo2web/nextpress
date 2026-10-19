import type { Ref } from 'react';
import { AI_PROVIDERS, type AiProviderId } from '@shared/ai-builder';
import { OptionButton } from '@/components/PageBuilder/shared/option-button';
import { OptionGroup } from '@/components/PageBuilder/shared/option-group';
import { AiFieldError } from './ai-field-error';
import { PROVIDER_HINTS } from './ai-settings-rules';

type AiProviderFieldProps = {
  value: AiProviderId;
  onChange: (provider: AiProviderId) => void;
  error?: string;
  groupRef: Ref<HTMLDivElement>;
};

const HINT_ID = 'ai-provider-hint';
const ERROR_ID = 'ai-provider-error';

/**
 * Which AI service the assistant uses. The option buttons carry no "pressed" state of their own,
 * so the picked one says "selected" in its name for people using a screen reader.
 */
export function AiProviderField({ value, onChange, error, groupRef }: AiProviderFieldProps) {
  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="AI service"
      aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
      tabIndex={-1}
      className="space-y-2 outline-none"
    >
      <OptionGroup label="AI service">
        {AI_PROVIDERS.map((provider) => {
          const isActive = provider.id === value;
          return (
            <OptionButton
              key={provider.id}
              isActive={isActive}
              ariaLabel={isActive ? `${provider.label}, selected` : provider.label}
              onClick={() => onChange(provider.id)}
            >
              {provider.label}
            </OptionButton>
          );
        })}
      </OptionGroup>
      <p id={HINT_ID} className="text-sm text-npb-text-muted">
        {PROVIDER_HINTS[value]}
      </p>
      <AiFieldError id={ERROR_ID} message={error} />
    </div>
  );
}
