/**
 * Shell runner for a forgotten password: `pnpm reset-password <email or username>` on a local copy,
 * and `nextpress reset-password <email or username>` on a live server, which pipes the password into
 * `docker compose exec -T app node dist/reset-password-cli.js <login>`.
 *
 * The login comes from the arguments. The password comes from standard input, never the arguments,
 * so it stays out of shell history and the process list: typed twice and hidden in a terminal, or
 * the first line of a pipe. Exit code 0 = changed, 1 = not changed.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { closeDatabase, pool } from "./db.js";
import { auth } from "./lib/better-auth.js";
import { resetPassword } from "./lib/accounts/reset-password.js";

const USAGE = "Usage: reset-password <email or username>";

/**
 * Asks for the password twice in a terminal without echoing it. readline owns the terminal (raw mode,
 * Enter, backspace) and its line iterator keeps lines that arrive together, as when typing ahead or
 * pasting. Echo goes to a stream that drops it. Ctrl+C or Ctrl+D ends the lines, which cancels.
 */
async function askHiddenTwice(): Promise<{ first: string; second: string } | null> {
	const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
	const reader = createInterface({ input: process.stdin, output: muted, terminal: true });
	reader.on("SIGINT", () => reader.close());
	const lines = reader[Symbol.asyncIterator]();
	try {
		process.stderr.write("New password: ");
		const first = await lines.next();
		process.stderr.write("\n");
		if (first.done) return null;
		process.stderr.write("Type it again: ");
		const second = await lines.next();
		process.stderr.write("\n");
		if (second.done) return null;
		return { first: first.value, second: second.value };
	} finally {
		reader.close();
	}
}

/** First line of a pipe, so `printf '%s\n' "$password" | …` works without trimming spaces inside it. */
async function readPipedPassword(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "";
}

async function readNewPassword(): Promise<string | null> {
	if (!process.stdin.isTTY) return readPipedPassword();
	const typed = await askHiddenTwice();
	if (!typed) {
		console.error("Cancelled. Nothing was changed.");
		return null;
	}
	if (typed.first === typed.second) return typed.first;
	console.error("The two passwords don't match. Nothing was changed.");
	return null;
}

async function main(): Promise<number> {
	const args = process.argv.slice(2);
	if (args.length !== 1 || args[0].startsWith("-")) {
		console.error(USAGE);
		return 1;
	}
	const login = args[0];

	const password = await readNewPassword();
	if (password === null) return 1;

	const result = await resetPassword({ login, password });
	if (!result.ok) {
		// A password that didn't read back may still have been written, so only the others say nothing changed.
		console.error(result.reason === "not_saved" ? result.message : `${result.message} Nothing was changed.`);
		return 1;
	}
	console.log(`Password changed for ${result.email ?? result.username}. They were signed out everywhere; sign in with the new password.`);
	return 0;
}

/**
 * Closes the database so the process ends promptly and a local copy is not left half-written.
 * Better Auth starts reading the database as soon as it loads, even when the command stops early
 * (a typo, passwords that differ), so that has to finish first: closing under it breaks the query
 * and can end the process with the wrong exit code.
 */
async function closeDb(): Promise<void> {
	await auth.$context.catch((error: Error) => {
		console.error({ atFunction: "resetPasswordCli.closeDb", data: { error }, message: "Sign-in setup failed before the database closed" });
	});
	await closeDatabase();
	if (!pool) return;
	try {
		await pool.end();
	} catch (error) {
		console.error({ atFunction: "resetPasswordCli.closeDb", data: { error }, message: "Could not close the database pool" });
	}
}

// The exit code is set after closing: closing PGlite resets process.exitCode to 0.
main()
	.then(async (code) => {
		await closeDb();
		process.exitCode = code;
	})
	.catch(async (error: Error) => {
		console.error({
			atFunction: "resetPasswordCli",
			data: { login: process.argv[2], error },
			message: "Password reset failed; nothing was confirmed as changed",
		});
		console.error("The password could not be changed. See the details above.");
		await closeDb();
		process.exitCode = 1;
	});
