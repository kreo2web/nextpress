import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  AI_SETTINGS_MESSAGES,
  type AiConnectionTestResult,
  type AiSaveError,
  type AiSaveErrorCode,
  type AiSaveField,
  type AiSaveInput,
  type AiSettingsResponse,
  type AiStatus,
} from '@shared/ai-builder';
import { apiRequest } from '@/lib/queryClient';
import { appendSiteIdToUrl } from '@/lib/site-api';
import { useToast } from '@/hooks/use-toast';

const STATUS_URL = '/api/ai-builder/status';
const SETTINGS_URL = '/api/ai-builder/settings';

const SAVE_ERROR_CODES: readonly AiSaveErrorCode[] = [
  'not_allowed',
  'rate_limited',
  'invalid_request',
  'key_needed',
  'address_refused',
  'not_ready',
  'save_failed',
];
const SAVE_FIELDS: readonly AiSaveField[] = ['provider', 'model', 'baseUrl', 'apiKey'];

const FALLBACK_SAVE_ERROR: AiSaveError = {
  message: AI_SETTINGS_MESSAGES.saveFailed,
  code: 'save_failed',
  field: null,
};

type RawSaveError = { message?: string; code?: string; field?: string | null };

/** What the form sends: the site comes from the hook, so the form never has to carry it. */
export type AiSaveValues = Omit<AiSaveInput, 'siteId'>;

export type AiSaveResult = { ok: true } | { ok: false; error: AiSaveError };

const statusKey = (siteId: string) => [STATUS_URL, siteId] as const;
const settingsKey = (siteId: string) => [SETTINGS_URL, siteId] as const;

const isSaveErrorCode = (value: string | undefined): value is AiSaveErrorCode =>
  SAVE_ERROR_CODES.some((code) => code === value);

const isSaveField = (value: string | null | undefined): value is AiSaveField =>
  SAVE_FIELDS.some((field) => field === value);

/**
 * Turns a failed save response into the shape the form marks fields with. `apiRequest` keeps only the
 * message and code of an error body and drops `field`, which the form needs, so the save reads the body itself.
 */
const readSaveError = async ({ response, siteId }: { response: Response; siteId: string }): Promise<AiSaveError> => {
  const text = await response.text();
  let body: RawSaveError | null = null;
  try {
    body = JSON.parse(text) as RawSaveError;
  } catch (error) {
    console.error({
      atFunction: 'useAiSettings.readSaveError',
      data: { siteId, status: response.status, error },
      message: 'The save answer was not in the expected shape',
    });
  }
  if (!body || typeof body.message !== 'string' || body.message.trim() === '') return FALLBACK_SAVE_ERROR;
  return {
    message: body.message,
    code: isSaveErrorCode(body.code) ? body.code : 'save_failed',
    field: isSaveField(body.field) ? body.field : null,
  };
};

/** The saved state the server answers with. A save that went through stays a success even if this can't be read. */
const readSavedView = async ({ response, siteId }: { response: Response; siteId: string }): Promise<AiSettingsResponse | null> => {
  try {
    return (await response.json()) as AiSettingsResponse;
  } catch (error) {
    console.error({
      atFunction: 'useAiSettings.readSavedView',
      data: { siteId, status: response.status, error },
      message: 'The settings were saved but the answer could not be read; they will be loaded again',
    });
    return null;
  }
};

const isSavedView = (body: AiSettingsResponse | null): body is Extract<AiSettingsResponse, { configured: true }> =>
  body !== null && body.configured === true;

/**
 * The server request that saves. The key travels in this one request body and is never kept anywhere
 * else: not in a query, not in the mutation cache, not in a log line.
 */
const sendSave = async ({
  input,
}: {
  input: AiSaveInput;
}): Promise<{ result: AiSaveResult; view: AiSettingsResponse | null }> => {
  const { siteId, provider } = input;
  try {
    const response = await fetch(SETTINGS_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      credentials: 'include',
    });
    if (!response.ok) {
      return { result: { ok: false, error: await readSaveError({ response, siteId }) }, view: null };
    }
    return { result: { ok: true }, view: await readSavedView({ response, siteId }) };
  } catch (error) {
    console.error({
      atFunction: 'useAiSettings.save',
      data: { siteId, provider, error },
      message: 'Could not reach the server to save the AI settings',
    });
    return { result: { ok: false, error: FALLBACK_SAVE_ERROR }, view: null };
  }
};

/**
 * The server's own sentence when a person can act on it (signed out, not allowed, too many tries);
 * otherwise the plain line the caller chose, so raw server text never reaches the screen.
 */
export const readServerMessage = ({ error, fallback }: { error: Error | null; fallback: string }): string => {
  const status = (error as (Error & { status?: number }) | null)?.status;
  const speaksForItself = status === 401 || status === 403 || status === 429;
  return speaksForItself && error?.message ? error.message : fallback;
};

/**
 * "Test connection": one tiny call with the saved settings. Always answers in plain words: the server's
 * own sentence when it gave one, otherwise a generic line, so raw error text never reaches the screen.
 */
export const testAiConnection = async ({ siteId }: { siteId: string }): Promise<AiConnectionTestResult> => {
  try {
    const response = await apiRequest('POST', appendSiteIdToUrl(`${SETTINGS_URL}/test`, siteId), { siteId });
    return (await response.json()) as AiConnectionTestResult;
  } catch (error) {
    console.error({ atFunction: 'testAiConnection', data: { siteId, error }, message: 'The connection test could not run' });
    return {
      ok: false,
      code: 'failed',
      message: readServerMessage({ error: error instanceof Error ? error : null, fallback: AI_SETTINGS_MESSAGES.testFailed }),
    };
  }
};

/** Whether the assistant is on for a site, and whether this person can turn it on. Shares its cache with Settings → AI. */
export function useAiStatus({ siteId }: { siteId: string }): UseQueryResult<AiStatus> {
  return useQuery<AiStatus>({
    queryKey: statusKey(siteId),
    enabled: siteId !== '',
    queryFn: async () => {
      const response = await apiRequest('GET', appendSiteIdToUrl(STATUS_URL, siteId));
      return response.json() as Promise<AiStatus>;
    },
  });
}

export type UseAiSettingsResult = {
  statusQuery: UseQueryResult<AiStatus>;
  /** Only runs for people who can manage the settings, since the server refuses everyone else. */
  settingsQuery: UseQueryResult<AiSettingsResponse>;
  saveSettings: (values: AiSaveValues) => Promise<AiSaveResult>;
  isSaving: boolean;
  removeSettings: () => Promise<boolean>;
  isRemoving: boolean;
};

/**
 * Reads and changes one site's AI settings for Settings → AI.
 *
 * Save and remove are plain async functions, not react-query mutations: a mutation keeps its input in a
 * cache, and the input here holds the key.
 */
export function useAiSettings({ siteId }: { siteId: string }): UseAiSettingsResult {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const statusQuery = useAiStatus({ siteId });

  const settingsQuery = useQuery<AiSettingsResponse>({
    queryKey: settingsKey(siteId),
    enabled: siteId !== '' && statusQuery.data?.canManage === true,
    queryFn: async () => {
      const response = await apiRequest('GET', appendSiteIdToUrl(SETTINGS_URL, siteId));
      return response.json() as Promise<AiSettingsResponse>;
    },
  });

  const refetchAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: statusKey(siteId) });
    void queryClient.invalidateQueries({ queryKey: settingsKey(siteId) });
  }, [queryClient, siteId]);

  const saveSettings = useCallback(
    async (values: AiSaveValues): Promise<AiSaveResult> => {
      setIsSaving(true);
      const { result, view } = await sendSave({ input: { ...values, siteId } });
      setIsSaving(false);
      if (!result.ok) return result;

      // The answer already is the saved state, so show it now; the refetch then confirms it.
      if (isSavedView(view)) queryClient.setQueryData(settingsKey(siteId), view);
      toast({ title: 'AI settings saved' });
      refetchAll();
      return result;
    },
    [queryClient, refetchAll, siteId, toast],
  );

  const removeSettings = useCallback(async (): Promise<boolean> => {
    setIsRemoving(true);
    try {
      await apiRequest('DELETE', appendSiteIdToUrl(SETTINGS_URL, siteId));
      queryClient.setQueryData<AiSettingsResponse>(settingsKey(siteId), { configured: false });
      toast({ title: 'AI settings removed' });
      refetchAll();
      return true;
    } catch (error) {
      console.error({
        atFunction: 'useAiSettings.remove',
        data: { siteId, error },
        message: 'Could not remove the AI settings',
      });
      toast({
        title: 'Could not remove the settings',
        description: readServerMessage({
          error: error instanceof Error ? error : null,
          fallback: AI_SETTINGS_MESSAGES.removeFailed,
        }),
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRemoving(false);
    }
  }, [queryClient, refetchAll, siteId, toast]);

  return { statusQuery, settingsQuery, saveSettings, isSaving, removeSettings, isRemoving };
}
