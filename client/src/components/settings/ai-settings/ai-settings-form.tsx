import { useState } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Trash2 } from 'lucide-react';
import { getAiProvider, type AiSettingsView } from '@shared/ai-builder';
import type { AiSaveResult, AiSaveValues } from '@/hooks/use-ai-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AiAddressField } from './ai-address-field';
import { AiKeyField } from './ai-key-field';
import { AiModelField } from './ai-model-field';
import { AiProviderField } from './ai-provider-field';
import { AiRemoveDialog } from './ai-remove-dialog';
import { usesAddress } from './ai-settings-rules';
import { useAiSettingsForm } from './use-ai-settings-form';

type AiSettingsFormProps = {
  /** The settings saved for this site, or null when none are saved yet. */
  saved: AiSettingsView | null;
  onSave: (values: AiSaveValues) => Promise<AiSaveResult>;
  isSaving: boolean;
  onRemove: () => Promise<boolean>;
  isRemoving: boolean;
};

const REASON_ID = 'ai-save-reason';
const FORM_ERROR_ID = 'ai-form-error';

const INTRO = "Pick the AI service this site's page assistant uses, then add your key.";

const describeSavedDate = (updatedAt: string): string => {
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? 'Saved for this site.' : `Last saved ${format(date, 'MMM d, yyyy')}.`;
};

/**
 * The form people with manage rights fill in. The panel mounts it again whenever the saved settings
 * change, so it always starts from what the server holds.
 */
export function AiSettingsForm({ saved, onSave, isSaving, onRemove, isRemoving }: AiSettingsFormProps) {
  const form = useAiSettingsForm({ saved, onSave, isSaving });
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const { draft, fieldErrors, refs } = form;
  const provider = getAiProvider(draft.provider);

  // Closed either way: on success the form is replaced, and on failure the toast must not sit behind the dialog.
  const handleRemove = async () => {
    await onRemove();
    setIsRemoveOpen(false);
  };

  return (
    <Card className="admin-surface">
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="mr-2 h-5 w-5 text-npb-accent" aria-hidden />
            Page assistant
          </CardTitle>
          <CardDescription>
            {saved ? describeSavedDate(saved.updatedAt) : INTRO}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <AiProviderField
            value={draft.provider}
            onChange={form.setProvider}
            error={fieldErrors.provider}
            groupRef={refs.provider}
          />
          {usesAddress(draft.provider) ? (
            <AiAddressField
              value={draft.baseUrl}
              onChange={form.setBaseUrl}
              error={fieldErrors.baseUrl}
              inputRef={refs.baseUrl}
            />
          ) : null}
          <AiModelField
            provider={provider}
            value={draft.model}
            onChange={form.setModel}
            error={fieldErrors.model}
            inputRef={refs.model}
          />
          <AiKeyField
            area={form.keyArea}
            provider={draft.provider}
            baseUrl={draft.baseUrl}
            value={draft.apiKey}
            onChange={form.setApiKey}
            onReplace={form.startReplace}
            onCancel={form.cancelReplace}
            error={fieldErrors.apiKey}
            inputRef={refs.apiKey}
          />
          {form.formError ? (
            <p id={FORM_ERROR_ID} role="alert" className="text-sm text-red-600 dark:text-red-400">
              {form.formError}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          {saved ? (
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={() => setIsRemoveOpen(true)}
            >
              <Trash2 aria-hidden />
              Remove
            </Button>
          ) : null}
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-4">
            {form.saveBlocker ? (
              <p id={REASON_ID} className="text-sm text-npb-text-muted sm:text-right">
                {form.saveBlocker}
              </p>
            ) : null}
            <Button
              type="submit"
              className="npb-btn-accent"
              disabled={Boolean(form.saveBlocker) || isSaving}
              aria-describedby={form.saveBlocker ? REASON_ID : undefined}
            >
              {isSaving ? <Spinner className="size-4" aria-hidden /> : null}
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardFooter>
      </form>

      <AiRemoveDialog
        open={isRemoveOpen}
        onOpenChange={setIsRemoveOpen}
        onConfirm={() => void handleRemove()}
        isRemoving={isRemoving}
      />
    </Card>
  );
}
