import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../better-auth";
import { safeTryAsync } from "../../utils";

type ErrorWithBody = Error & { body?: { code?: string } };

const isWrongPassword = (error: Error): boolean => (error as ErrorWithBody).body?.code === "INVALID_PASSWORD";

/**
 * Checks the signed-in person's password again right before an install-wide action. A wrong password is
 * `false`; anything else (no session, database down) throws so the caller logs it and answers with an error.
 */
export async function verifySessionPassword({ req, password }: { req: Request; password: string }): Promise<boolean> {
	const { err, result } = await safeTryAsync(() =>
		auth.api.verifyPassword({ body: { password }, headers: fromNodeHeaders(req.headers) }),
	);
	if (!err) return result?.status === true;
	if (isWrongPassword(err)) return false;
	throw err;
}
