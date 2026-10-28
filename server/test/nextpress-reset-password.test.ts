import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Drives the real bash CLI (scripts/nextpress) by sourcing it and replacing only Docker: `compose`
 * records what the app container would be handed. The command's own checks and hand-off are real.
 */
const SCRIPT = fileURLToPath(new URL("../../scripts/nextpress", import.meta.url));
const PASSWORD = "pw-from-test-1";
const LOGIN = "you@example.com";

const DOCKER_STUB = `
assert_install_dir_exists() { :; }
assert_docker_available() { :; }
compose() {
	case "$*" in
		"ps --status running -q app") echo "app-container" ;;
		"exec -T app test -f dist/reset-password-cli.js") [ "\${FAKE_NO_RUNNER:-}" != "1" ] ;;
		"exec -T app node dist/reset-password-cli.js "*)
			printf '%s\\n' "$*" >> "$INSTALL_DIR/args.log"
			cat >> "$INSTALL_DIR/stdin.log"
			return "\${FAKE_APP_EXIT:-0}"
			;;
		*) echo "unexpected compose call: $*" >&2; return 99 ;;
	esac
}
`;

type BashResult = { code: number | null; stdout: string; stderr: string };

let workDir: string;
let installDir: string;

const runBash = ({ body, env = {} }: { body: string; env?: Record<string, string> }): BashResult => {
	const driver = path.join(workDir, "driver.sh");
	fs.writeFileSync(
		driver,
		`#!/usr/bin/env bash\nset -euo pipefail\nsource ${JSON.stringify(SCRIPT)}\nINSTALL_DIR=${JSON.stringify(installDir)}\n${DOCKER_STUB}\n${body}\n`,
	);
	// setsid: no controlling terminal, like a cron job or CI step, so a prompt can never wait on the person running tests.
	const result = spawnSync("setsid", ["--wait", "bash", driver], { encoding: "utf8", timeout: 30_000, env: { ...process.env, ...env } });
	return { code: result.status, stdout: result.stdout, stderr: result.stderr };
};

const readLog = (name: string): string | null => {
	const file = path.join(installDir, name);
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
};

describe("nextpress reset-password", () => {
	beforeEach(() => {
		workDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextpress-reset-password-"));
		installDir = path.join(workDir, "install");
		fs.mkdirSync(installDir);
		fs.writeFileSync(path.join(installDir, "docker-compose.prod.yml"), "services: {}\n");
	});

	afterEach(() => {
		fs.rmSync(workDir, { recursive: true, force: true });
	});

	it("hands the app the login as an argument and the password only on standard input", () => {
		const result = runBash({ body: `printf '%s\\n' ${JSON.stringify(PASSWORD)} | run_reset_password ${LOGIN} --password-stdin` });

		expect(result.code).toBe(0);
		expect(readLog("args.log")).toBe(`exec -T app node dist/reset-password-cli.js ${LOGIN}\n`);
		expect(readLog("stdin.log")).toBe(`${PASSWORD}\n`);
	});

	it("takes a piped password with no line ending", () => {
		const result = runBash({ body: `printf '%s' ${JSON.stringify(PASSWORD)} | run_reset_password ${LOGIN} --password-stdin` });

		expect(result.code).toBe(0);
		expect(readLog("stdin.log")).toBe(`${PASSWORD}\n`);
	});

	it("exits with the app's failure", () => {
		const result = runBash({
			body: `printf '%s\\n' ${JSON.stringify(PASSWORD)} | run_reset_password ${LOGIN} --password-stdin`,
			env: { FAKE_APP_EXIT: "1" },
		});

		expect(result.code).toBe(1);
	});

	it("stops before asking for a password when the install is too old", () => {
		const result = runBash({
			body: `printf '%s\\n' ${JSON.stringify(PASSWORD)} | run_reset_password ${LOGIN} --password-stdin`,
			env: { FAKE_NO_RUNNER: "1" },
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Run: nextpress upgrade");
		expect(readLog("stdin.log")).toBeNull();
	});

	it("refuses to prompt when there is no terminal and no --password-stdin", () => {
		const result = runBash({ body: `run_reset_password ${LOGIN}` });

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("without an interactive terminal");
		expect(readLog("args.log")).toBeNull();
	});

	it("asks for the login when it is missing", () => {
		const result = runBash({ body: "run_reset_password --password-stdin </dev/null" });

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Missing email or username");
	});
});
