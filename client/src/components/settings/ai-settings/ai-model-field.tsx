import type { Ref } from 'react';
import { AI_SETTINGS_LIMITS, type AiProviderInfo } from '@shared/ai-builder';
import { Input } from '@/components/ui/input';
import { SettingsLabel } from '@/components/PageBuilder/shared/settings-label';
import { AiChoiceChip } from './ai-choice-chip';
import { AiFieldError } from './ai-field-error';

type AiModelFieldProps = {
  provider: AiProviderInfo;
  value: string;
  onChange: (model: string) => void;
  error?: string;
  inputRef: Ref<HTMLInputElement>;
};

const INPUT_ID = 'ai-model';
const HELP_ID = 'ai-model-help';
const ERROR_ID = 'ai-model-error';

/**
 * The model's name, typed freely: model names change often, so the suggestions are quick fills,
 * not the only allowed values.
 */
export function AiModelField({ provider, value, onChange, error, inputRef }: AiModelFieldProps) {
  const suggestions = provider.modelSuggestions;
  return (
    <div className="space-y-2">
      <SettingsLabel htmlFor={INPUT_ID}>Model name</SettingsLabel>
      <Input
        id={INPUT_ID}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="The name your provider lists"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={AI_SETTINGS_LIMITS.model}
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${HELP_ID} ${ERROR_ID}` : HELP_ID}
      />
      {suggestions.length > 0 ? (
        <div role="group" aria-label="Suggested models" className="flex flex-wrap gap-2">
          {suggestions.map((name) => (
            <AiChoiceChip key={name} isActive={value === name} onClick={() => onChange(name)}>
              {name}
            </AiChoiceChip>
          ))}
        </div>
      ) : null}
      <p id={HELP_ID} className="text-sm text-npb-text-muted">
        {suggestions.length > 0
          ? 'Pick a suggestion or type the name of another model.'
          : "Type the model's name exactly as your provider lists it."}
      </p>
      <AiFieldError id={ERROR_ID} message={error} />
    </div>
  );
}
