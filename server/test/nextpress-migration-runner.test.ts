import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = new URL("../../scripts/nextpress", import.meta.url).pathname;

describe("nextpress migration runner selection", () => {
	it.each([
		{ runner: true, exit: 0, expected: "bundled" },
		{ runner: true, exit: 7, expected: "bundled" },
		{ runner: false, exit: 0, expected: "legacy" },
		{ runner: false, exit: 9, expected: "legacy" },
	])("returns $exit with runner present=$runner", ({ runner, exit, expected }) => {
		const dir = mkdtempSync(join(tmpdir(), "nextpress-migrate-"));
		mkdirSync(join(dir, "dist"));
		mkdirSync(join(dir, "bin"));
		if (runner) writeFileSync(join(dir, "dist/migrate.js"), `require('node:fs').appendFileSync('calls', 'bundled'); process.exit(${exit});`);
		writeFileSync(join(dir, "bin/pnpm"), `#!/bin/sh\nprintf legacy >> calls\nexit ${exit}\n`, { mode: 0o755 });
		const result = spawnSync("bash", ["-c", `
source "$1"
compose() { shift 4; "$@"; }
run_schema_migrations test-image
`, "test", script], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}` } });
		expect(result.status, result.stderr).toBe(exit);
		expect(readFileSync(join(dir, "calls"), "utf8")).toBe(expected);
	});
});
