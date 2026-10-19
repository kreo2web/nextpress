import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AiProviderId, AiSaveError, AiSaveField, AiSettingsView } from '@shared/ai-builder';
import type { AiSaveResult, AiSaveValues } from '@/hooks/use-ai-settings';
import {
  buildSaveValues,
  describeKeyArea,
  draftFromView,
  findSaveBlocker,
  type AiDraft,
  type AiFieldErrors,
  type KeyArea,
} from './ai-settings-rules';

type FieldRefs = {
  provider: RefObject<HTMLDivElement | null>;
  baseUrl: RefObject<HTMLInputElement | null>;
  model: RefObject<HTMLInputElement | null>;
  apiKey: RefObject<HTMLInputElement | null>;
};

export type AiSettingsFormState = {
  draft: AiDraft;
  keyArea: KeyArea;
  fieldErrors: AiFieldErrors;
  /** An error that belongs to no single input (too many tries, server not ready). */
  formError: string | null;
  /** Why Save can't be pressed yet, or null. Shown beside the button. */
  saveBlocker: string | null;
  refs: FieldRefs;
  setProvider: (provider: AiProviderId) => void;
  setBaseUrl: (value: string) => void;
  setModel: (value: string) => void;
  setApiKey: (value: string) => void;
  startReplace: () => void;
  cancelReplace: () => void;
  submit: () => Promise<void>;
};

/**
 * All the state of the AI settings form: what is typed, which inputs are marked, and the save.
 *
 * The address is kept while another provider is picked, so going away from the generic choice and
 * back does not lose it. The form starts from `saved` once; the panel remounts it when the saved
 * settings change, so nothing here has to be re-synced.
 */
export function useAiSettingsForm({
  saved,
  onSave,
  isSaving,
}: {
  saved: AiSettingsView | null;
  onSave: (values: AiSaveValues) => Promise<AiSaveResult>;
  isSaving: boolean;
}): AiSettingsFormState {
  const [draft, setDraft] = useState<AiDraft>(() => draftFromView(saved));
  const [isReplacing, setIsReplacing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AiFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const focusAfterRender = useRef<AiSaveField | null>(null);

  const refs: FieldRefs = {
    provider: useRef<HTMLDivElement | null>(null),
    baseUrl: useRef<HTMLInputElement | null>(null),
    model: useRef<HTMLInputElement | null>(null),
    apiKey: useRef<HTMLInputElement | null>(null),
  };

  const keyArea = useMemo(() => describeKeyArea({ saved, draft, isReplacing }), [saved, draft, isReplacing]);
  const saveBlocker = useMemo(() => findSaveBlocker({ draft, area: keyArea }), [draft, keyArea]);

  const clearError = useCallback((field: AiSaveField) => {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }, []);

  const setProvider = useCallback(
    (provider: AiProviderId) => {
      setDraft((current) => ({ ...current, provider }));
      clearError('provider');
      clearError('baseUrl');
    },
    [clearError],
  );
  const setBaseUrl = useCallback(
    (baseUrl: string) => {
      setDraft((current) => ({ ...current, baseUrl }));
      clearError('baseUrl');
    },
    [clearError],
  );
  const setModel = useCallback(
    (model: string) => {
      setDraft((current) => ({ ...current, model }));
      clearError('model');
    },
    [clearError],
  );
  const setApiKey = useCallback(
    (apiKey: string) => {
      setDraft((current) => ({ ...current, apiKey }));
      clearError('apiKey');
    },
    [clearError],
  );

  const startReplace = useCallback(() => setIsReplacing(true), []);
  const cancelReplace = useCallback(() => {
    setIsReplacing(false);
    setDraft((current) => ({ ...current, apiKey: '' }));
    clearError('apiKey');
  }, [clearError]);

  /** Marks the input the server named, opens the key box if that is the one, and moves focus there. */
  const showSaveError = useCallback((error: AiSaveError) => {
    if (!error.field) {
      setFormError(error.message);
      return;
    }
    if (error.field === 'apiKey') setIsReplacing(true);
    focusAfterRender.current = error.field;
    setFieldErrors({ [error.field]: error.message });
  }, []);

  // Runs after every render but acts only once, right after a failed save has put its marks on screen.
  useEffect(() => {
    const field = focusAfterRender.current;
    if (!field) return;
    focusAfterRender.current = null;
    refs[field].current?.focus();
  });

  const submit = useCallback(async () => {
    // A second press while a save is under way would burn one of the few saves allowed per person.
    if (saveBlocker || isSaving) return;
    setFieldErrors({});
    setFormError(null);
    const result = await onSave(buildSaveValues({ draft, area: keyArea }));
    if (result.ok) {
      setDraft((current) => ({ ...current, apiKey: '' }));
      setIsReplacing(false);
      return;
    }
    showSaveError(result.error);
  }, [draft, isSaving, keyArea, onSave, saveBlocker, showSaveError]);

  return {
    draft,
    keyArea,
    fieldErrors,
    formError,
    saveBlocker,
    refs,
    setProvider,
    setBaseUrl,
    setModel,
    setApiKey,
    startReplace,
    cancelReplace,
    submit,
  };
}
