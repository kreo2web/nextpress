import {
  getAiProvider,
  normalizeAiAddress,
  type AiProviderId,
  type AiSaveField,
  type AiSettingsView,
} from '@shared/ai-builder';
import type { AiSaveValues } from '@/hooks/use-ai-settings';

/** What the person is typing. The key lives here only until a save succeeds or the form is left. */
export type AiDraft = {
  provider: AiProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type AiFieldErrors = Partial<Record<AiSaveField, string>>;

/** Why the key box is showing, which decides the words around it and whether leaving it empty is allowed. */
export type KeyInputReason = 'first' | 'changed' | 'unreadable' | 'replace' | 'add';

export type KeyArea =
  | { mode: 'input'; reason: KeyInputReason }
  | { mode: 'saved'; ending: string }
  | { mode: 'none' };

export const DEFAULT_PROVIDER: AiProviderId = 'anthropic';

/** One line per choice. Shown under the choices for the one that is picked. */
export const PROVIDER_HINTS: Record<AiProviderId, string> = {
  anthropic: 'Claude models. You need a key from Anthropic.',
  openai: 'GPT models. You need a key from OpenAI.',
  google: 'Gemini models. You need a key from Google.',
  'openai-compatible': 'OpenRouter, Ollama, LM Studio and other services that work like OpenAI.',
};

/** Only the first two are sure enough to promise; a wrong promise sends people hunting for a mistake. */
export const KEY_PLACEHOLDERS: Record<AiProviderId, string> = {
  anthropic: 'Starts with sk-ant-',
  openai: 'Starts with sk-',
  google: 'Paste the key',
  'openai-compatible': 'Paste the key',
};

export const usesAddress = (provider: AiProviderId): boolean => getAiProvider(provider).needsAddress;

export const draftFromView = (view: AiSettingsView | null): AiDraft => ({
  provider: view?.provider ?? DEFAULT_PROVIDER,
  baseUrl: view?.baseUrl ?? '',
  model: view?.model ?? '',
  apiKey: '',
});

const HOST_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#@]*@)?(\[[^\]]+\]|[^/?#:]+)/i;
const PRIVATE_IPV4 = /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;
const LOCAL_SUFFIXES = ['.local', '.lan', '.internal', '.home.arpa'];

/**
 * A guess from the typed address, used only to word the key hint. The server makes the real call,
 * so a wrong guess never blocks a save.
 */
export const looksLocalAddress = (address: string): boolean => {
  const host = HOST_PATTERN.exec(address.trim())?.[1]?.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '0.0.0.0' || host === '[::1]') return true;
  if (PRIVATE_IPV4.test(host)) return true;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return !host.includes('.') && !host.startsWith('[');
};

/** The provider or address differs from what is saved, so the saved key no longer belongs to it. */
export const isServiceChanged = ({ saved, draft }: { saved: AiSettingsView; draft: AiDraft }): boolean => {
  if (draft.provider !== saved.provider) return true;
  if (!usesAddress(draft.provider)) return false;
  return normalizeAiAddress(draft.baseUrl) !== normalizeAiAddress(saved.baseUrl ?? '');
};

/**
 * What the key part of the form shows. A key already saved stays hidden behind Replace; a new,
 * changed or unreadable situation shows the box straight away because a key is needed.
 */
export const describeKeyArea = ({
  saved,
  draft,
  isReplacing,
}: {
  saved: AiSettingsView | null;
  draft: AiDraft;
  isReplacing: boolean;
}): KeyArea => {
  if (!saved) return { mode: 'input', reason: 'first' };
  if (isServiceChanged({ saved, draft })) return { mode: 'input', reason: 'changed' };
  if (saved.keyUnreadable) return { mode: 'input', reason: 'unreadable' };
  if (isReplacing) return { mode: 'input', reason: saved.hasKey ? 'replace' : 'add' };
  if (saved.hasKey) return { mode: 'saved', ending: saved.keyEnding ?? '' };
  return { mode: 'none' };
};

/**
 * Whether the form itself can tell a key is needed. For the generic OpenAI-compatible choice it can't:
 * a service on this computer may need none, and only the server knows which addresses count as local.
 */
export const isKeyRequired = ({ area, provider }: { area: KeyArea; provider: AiProviderId }): boolean => {
  if (area.mode !== 'input') return false;
  if (area.reason === 'unreadable') return true;
  if (area.reason === 'replace' || area.reason === 'add') return false;
  return provider !== 'openai-compatible';
};

/** The first thing still missing, in the order the form reads, or null when it can be saved. */
export const findSaveBlocker = ({ draft, area }: { draft: AiDraft; area: KeyArea }): string | null => {
  if (usesAddress(draft.provider) && draft.baseUrl.trim() === '') return 'Enter the address to save.';
  if (draft.model.trim() === '') return "Enter the model's name to save.";
  if (isKeyRequired({ area, provider: draft.provider }) && draft.apiKey.trim() === '') {
    return 'Enter your key to save.';
  }
  return null;
};

/** The request body. The key goes only while its box is showing, so a saved key is never re-sent or lost. */
export const buildSaveValues = ({ draft, area }: { draft: AiDraft; area: KeyArea }): AiSaveValues => {
  const apiKey = draft.apiKey.trim();
  return {
    provider: draft.provider,
    model: draft.model.trim(),
    ...(usesAddress(draft.provider) ? { baseUrl: draft.baseUrl.trim() } : {}),
    ...(area.mode === 'input' && apiKey !== '' ? { apiKey } : {}),
  };
};

/** Matches a typed address to a preset, ignoring a trailing slash. */
export const isSameAddress = ({ a, b }: { a: string; b: string }): boolean =>
  normalizeAiAddress(a) !== '' && normalizeAiAddress(a) === normalizeAiAddress(b);
