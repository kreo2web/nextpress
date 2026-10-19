import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { z } from "zod";
import { safeTry, type SafeTryResult } from "../../utils";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

/** Fixed on purpose: the passphrase is the secret part, and the same salt lets a saved key be opened after a restart. */
const KEY_SALT = "nextpress-ai-keys-v1";
const KEY_INFO = "nextpress-ai-keys";

/** One locked secret as stored. `v` lets a later version change the lock without guessing at old data. */
export type SealedSecret = {
	v: 1;
	iv: string;
	tag: string;
	data: string;
};

export const sealedSecretSchema = z.object({
	v: z.literal(1),
	iv: z.string().min(1),
	tag: z.string().min(1),
	data: z.string().min(1),
});

export type OpenSecretResult = { ok: true; secret: string } | { ok: false; cause: Error };

/** The lock key comes from the server's sign-in secret, so no extra setting is needed. */
const deriveLockKey = (passphrase: string): Buffer =>
	Buffer.from(hkdfSync("sha256", passphrase, KEY_SALT, KEY_INFO, KEY_BYTES));

/**
 * Locks a secret with AES-256-GCM under a key made from `passphrase`. A new random IV is used for every
 * call, so saving the same key twice gives different stored text.
 */
export function sealSecret({ secret, passphrase }: { secret: string; passphrase: string }): SealedSecret {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, deriveLockKey(passphrase), iv, { authTagLength: TAG_BYTES });
	const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
	return {
		v: 1,
		iv: iv.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
		data: data.toString("base64"),
	};
}

/** Throws on a wrong passphrase, changed data or a wrong-sized start or check value. */
const decryptSecret = ({ sealed, passphrase }: { sealed: SealedSecret; passphrase: string }): string => {
	const iv = Buffer.from(sealed.iv, "base64");
	const tag = Buffer.from(sealed.tag, "base64");
	if (iv.length !== IV_BYTES) throw new Error("Stored lock has the wrong start value length");
	if (tag.length !== TAG_BYTES) throw new Error("Stored lock has the wrong check value length");

	const decipher = createDecipheriv(ALGORITHM, deriveLockKey(passphrase), iv, { authTagLength: TAG_BYTES });
	decipher.setAuthTag(tag);
	const secret = Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]);
	return secret.toString("utf8");
};

/**
 * Opens a locked secret. A wrong passphrase, a changed tag or damaged data all come back as `ok: false`
 * with the cause, never as a throw: the caller shows "enter the key again" and logs the cause.
 */
export function openSecret({ sealed, passphrase }: { sealed: SealedSecret; passphrase: string }): OpenSecretResult {
	// safeTry is typed to also accept async functions; this callback is synchronous, so the result is never a Promise.
	const { err, result } = safeTry(() => decryptSecret({ sealed, passphrase })) as SafeTryResult<string>;
	if (err || result === null) {
		return { ok: false, cause: err instanceof Error ? err : new Error("The saved secret could not be opened") };
	}
	return { ok: true, secret: result };
}
