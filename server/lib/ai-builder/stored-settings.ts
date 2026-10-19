import { z } from "zod";
import { AI_PROVIDER_IDS, type AiSettingsView } from "@shared/ai-builder";
import { safeTryAsync } from "../../utils";
import { openSecret, sealedSecretSchema } from "./secret-box";

/**
 * What goes into the `ai_builder` option, as JSON. Only `key` is locked; the rest is plain.
 * `key` is `null` when a local service (Ollama, LM Studio) was saved without one: "no key" is written down
 * on purpose, so it never looks like a key that went missing.
 */
const storedSettingsSchema = z.object({
	provider: z.enum(AI_PROVIDER_IDS),
	model: z.string().min(1),
	baseUrl: z.string().optional(),
	key: sealedSecretSchema.nullable(),
	keyEnding: z.string().nullable(),
	updatedAt: z.string(),
	updatedBy: z.string(),
});

export type StoredAiSettings = z.infer<typeof storedSettingsSchema>;

export type ParsedStoredSettings = { ok: true; stored: StoredAiSettings } | { ok: false; cause: Error };

/** Reads the saved JSON. Damaged or hand-edited data comes back as a failure with the cause, never a throw. */
export async function parseStoredSettings(value: string): Promise<ParsedStoredSettings> {
	const { err, result: json } = await safeTryAsync(async () => JSON.parse(value) as Record<string, string>);
	if (err) return { ok: false, cause: err };
	const parsed = storedSettingsSchema.safeParse(json);
	if (!parsed.success) return { ok: false, cause: new Error(parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")) };
	return { ok: true, stored: parsed.data };
}

/**
 * The write-only view of saved settings: never the key, and never the locked text. The key is opened here
 * only to learn whether this server can still read it. Saved without a key is not "unreadable".
 */
export function toSettingsView({ stored, passphrase }: { stored: StoredAiSettings; passphrase: string }): AiSettingsView {
	const keyUnreadable = stored.key !== null && !openSecret({ sealed: stored.key, passphrase }).ok;
	return {
		configured: true,
		provider: stored.provider,
		model: stored.model,
		baseUrl: stored.baseUrl ?? null,
		hasKey: stored.key !== null,
		keyEnding: keyUnreadable ? null : stored.keyEnding,
		keyUnreadable,
		updatedAt: stored.updatedAt,
	};
}
