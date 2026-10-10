import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CORE_UPDATE_FAILURE_CODES, CORE_UPDATE_PROTOCOL, CORE_UPDATE_TIMING } from "@shared/core-update";

/**
 * Drives the real bash CLI (scripts/nextpress) by sourcing it, then replacing only the outside world: GitHub,
 * Docker and the upgrade itself (stubs below). The runner's own decisions, files and permissions are real.
 */
const SCRIPT = fileURLToPath(new URL("../../scripts/nextpress", import.meta.url));
const SCRIPT_TEXT = fs.readFileSync(SCRIPT, "utf8");

const fixture = (name: string): string => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const RUNNER_STUBS = `source ${JSON.stringify(fixture("update-runner-stubs.sh"))}`;
const HELPER_STUBS = `source ${JSON.stringify(fixture("update-helper-stubs.sh"))}`;

type BashResult = { code: number | null; stdout: string; stderr: string };

let workDir: string;
let installDir: string;
let driverCount = 0;

const runBash = ({ body, env = {} }: { body: string; env?: Record<string, string> }): BashResult => {
	driverCount += 1;
	const driver = path.join(workDir, `driver-${driverCount}.sh`);
	fs.writeFileSync(
		driver,
		`#!/usr/bin/env bash\nset -euo pipefail\nsource ${JSON.stringify(SCRIPT)}\nINSTALL_DIR=${JSON.stringify(installDir)}\n${body}\n`,
	);
	const result = spawnSync("bash", [driver], {
		encoding: "utf8",
		timeout: 30_000,
		env: { ...process.env, BASH_ENV: "", ENV: "", NEXTPRESS_UPGRADE_REEXEC: "", NEXTPRESS_SKIP_IMAGE_PULL: "", ...env },
	});
	return { code: result.status, stdout: result.stdout, stderr: result.stderr };
};

const updateDir = (): string => path.join(installDir, "update");
const logDir = (): string => path.join(installDir, "update-logs");

const writeRequest = ({
	requestId = "req-00000001",
	version = "1.4.3",
	ageSeconds = 0,
	raw,
}: {
	requestId?: string;
	version?: string;
	ageSeconds?: number;
	raw?: string;
} = {}): string => {
	const file = path.join(updateDir(), "request.json");
	const body =
		raw ??
		JSON.stringify(
			{ protocol: 1, requestId, version, requestedBy: "11111111-2222-3333-4444-555555555555", requestedAt: new Date().toISOString() },
			null,
			2,
		);
	fs.writeFileSync(file, body);
	const at = new Date(Date.now() - ageSeconds * 1000);
	fs.utimesSync(file, at, at);
	return file;
};

const readStatus = (): Record<string, string | number | boolean> =>
	JSON.parse(fs.readFileSync(path.join(updateDir(), "status.json"), "utf8")) as Record<string, string | number | boolean>;

const readCalls = (): string[] => {
	const file = path.join(installDir, "calls.log");
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n") : [];
};

const runRunner = (env: Record<string, string> = {}): BashResult =>
	runBash({ body: `${RUNNER_STUBS}\nrun_update_runner`, env });

beforeEach(() => {
	workDir = fs.mkdtempSync(path.join(os.tmpdir(), "np-cli-"));
	installDir = path.join(workDir, "install");
	fs.mkdirSync(path.join(installDir, "update"), { recursive: true });
	fs.writeFileSync(path.join(installDir, ".env"), "POSTGRES_PASSWORD=x\nNEXTPRESS_VERSION=beta-v1.4.2\n");
});

afterEach(() => {
	fs.rmSync(workDir, { recursive: true, force: true });
});

describe("update runner", () => {
	it("does nothing, quietly, when no request is waiting", () => {
		const result = runRunner();
		expect(result.code).toBe(0);
		expect(result.stdout).toBe("");
		expect(fs.existsSync(path.join(updateDir(), "status.json"))).toBe(false);
		expect(readCalls()).toEqual([]);
	});

	it("downloads first, then upgrades to the requested official release, and reports done", () => {
		writeRequest();
		const result = runRunner();
		expect(result.code).toBe(0);
		expect(readCalls()).toEqual(["pull 1.4.3", "upgrade 1.4.3"]);
		expect(fs.existsSync(path.join(updateDir(), "request.json"))).toBe(false);

		const status = readStatus();
		expect(status).toMatchObject({
			protocol: CORE_UPDATE_PROTOCOL,
			state: "done",
			code: "updated",
			requestId: "req-00000001",
			version: "1.4.3",
			fromTag: "beta-v1.4.2",
			siteRestored: false,
		});
		expect(String(status.logPath).startsWith(logDir())).toBe(true);
		expect(fs.readFileSync(String(status.logPath), "utf8")).toContain(
			"Requested by user 11111111-2222-3333-4444-555555555555: beta-v1.4.2 -> beta-v1.4.3.",
		);
		expect(fs.statSync(path.join(updateDir(), "status.json")).mode & 0o777).toBe(0o644);
		expect(fs.statSync(logDir()).mode & 0o777).toBe(0o700);
		expect(fs.existsSync(path.join(logDir(), "last-status.json"))).toBe(true);
	});

	it("shows the run as under way before its slower checks, so the dashboard can't start a second one", () => {
		writeRequest();
		runRunner();
		const during = JSON.parse(fs.readFileSync(path.join(installDir, "status-during-check.json"), "utf8")) as Record<string, string>;
		expect(during).toMatchObject({ state: "running", step: "waiting", requestId: "req-00000001", version: "1.4.3" });
	});

	it("changes nothing when the download fails", () => {
		writeRequest();
		runRunner({ FAKE_PULL_FAILS: "1" });
		expect(readCalls()).toEqual(["pull 1.4.3"]);
		expect(readStatus()).toMatchObject({ state: "failed", code: "download_failed" });
	});

	it("puts the previous version back when the upgrade fails, and says why it failed", () => {
		writeRequest();
		runRunner({ FAKE_UPGRADE_ERROR: "Need at least 1024MB free at /opt/nextpress (found 200MB)." });
		expect(readCalls()).toEqual(["pull 1.4.3", "upgrade 1.4.3", "restore beta-v1.4.2"]);
		expect(readStatus()).toMatchObject({ state: "failed", code: "low_disk", siteRestored: true });
	});

	it("reports a failed restore honestly", () => {
		writeRequest();
		runRunner({ FAKE_UPGRADE_ERROR: "Something broke", FAKE_RESTORE_FAILS: "1" });
		expect(readStatus()).toMatchObject({ state: "failed", code: "upgrade_failed", siteRestored: false });
	});

	it("leaves the stack alone when a hand-started upgrade took the lock first", () => {
		writeRequest();
		runRunner({ FAKE_UPGRADE_ERROR: "Another NextPress update is already running on this server. Wait for it to finish, then try again." });
		expect(readCalls()).toEqual(["pull 1.4.3", "upgrade 1.4.3"]);
		expect(readStatus()).toMatchObject({ state: "failed", code: "busy" });

		writeRequest({ requestId: "req-00000002" });
		runRunner({ FAKE_LOCK_BUSY: "1" });
		expect(readCalls()).toHaveLength(2);
		expect(readStatus()).toMatchObject({ state: "failed", code: "busy", requestId: "req-00000002" });
	});

	it("only installs the newest official release, checked by the runner itself", () => {
		writeRequest({ version: "1.4.3" });
		runRunner({ FAKE_LATEST: "1.4.4" });
		expect(readStatus()).toMatchObject({ state: "failed", code: "not_latest" });

		writeRequest({ requestId: "req-00000002" });
		runRunner({ FAKE_LATEST_FAILS: "1" });
		expect(readStatus()).toMatchObject({ state: "failed", code: "release_check_failed" });
		expect(readCalls()).toEqual([]);
	});

	it("refuses requests it can't trust, without running anything", () => {
		writeRequest({ version: "1.4.3; rm -rf /" });
		runRunner();
		expect(readStatus()).toMatchObject({ state: "failed", code: "bad_request", requestId: "req-00000001" });

		writeRequest({ requestId: "../../etc" });
		runRunner();
		expect(readStatus()).toMatchObject({ state: "failed", code: "bad_request", requestId: "" });

		writeRequest({ raw: `{"requestId": "req-00000003", "version": "1.4.3", "pad": "${"x".repeat(5000)}"}` });
		runRunner();
		expect(readStatus()).toMatchObject({ state: "failed", code: "bad_request" });

		writeRequest({ requestId: "req-00000004", ageSeconds: 10 * 60 });
		runRunner();
		expect(readStatus()).toMatchObject({ state: "failed", code: "expired", requestId: "req-00000004" });
		expect(readCalls()).toEqual([]);
	});

	it("moves a planted link out of reach and never reads or writes through it", () => {
		const secret = path.join(workDir, "secret.txt");
		fs.writeFileSync(secret, "do not touch");
		fs.symlinkSync(secret, path.join(updateDir(), "request.json"));
		fs.symlinkSync(secret, path.join(updateDir(), "status.json"));

		runRunner();
		expect(fs.readFileSync(secret, "utf8")).toBe("do not touch");
		expect(fs.lstatSync(path.join(updateDir(), "status.json")).isSymbolicLink()).toBe(false);
		expect(readStatus()).toMatchObject({ state: "failed", code: "bad_request" });
		expect(fs.existsSync(path.join(updateDir(), "request.json"))).toBe(false);
		expect(readCalls()).toEqual([]);
	});

	it("ignores a repeated trigger for a request it already finished", () => {
		writeRequest();
		runRunner();
		const before = fs.readFileSync(path.join(updateDir(), "status.json"), "utf8");

		writeRequest();
		runRunner();
		expect(fs.readFileSync(path.join(updateDir(), "status.json"), "utf8")).toBe(before);
		expect(readCalls()).toEqual(["pull 1.4.3", "upgrade 1.4.3"]);
	});

	it("reports an interrupted earlier run instead of starting it again", () => {
		fs.mkdirSync(logDir(), { recursive: true });
		fs.writeFileSync(
			path.join(logDir(), "last-status.json"),
			JSON.stringify({ state: "running", requestId: "req-00000001", code: "running" }, null, 2),
		);
		writeRequest();
		runRunner();
		expect(readStatus()).toMatchObject({ state: "failed", code: "interrupted" });
		expect(readCalls()).toEqual([]);
	});

	it("tells the dashboard when the runner itself stops unexpectedly", () => {
		writeRequest();
		const result = runBash({
			body: `${RUNNER_STUBS}
log_update() { if [[ "$*" == Requested* ]]; then exit 9; fi; }
run_update_runner`,
		});
		expect(result.code).toBe(9);
		expect(readStatus()).toMatchObject({ state: "failed", code: "runner_error", requestId: "req-00000001" });
	});

	it("keeps only the newest update logs", () => {
		fs.mkdirSync(logDir(), { recursive: true });
		for (let index = 0; index < 12; index += 1) {
			const file = path.join(logDir(), `update-2026010${index % 10}-00000${index}.log`);
			fs.writeFileSync(file, "old");
			const at = new Date(Date.now() - (20 - index) * 60_000);
			fs.utimesSync(file, at, at);
		}
		writeRequest();
		runRunner();
		expect(fs.readdirSync(logDir()).filter((name) => name.startsWith("update-")).length).toBe(10);
	});
});

describe("update helper switch and service units", () => {
	const readMarker = (): Record<string, string | number | boolean> =>
		JSON.parse(fs.readFileSync(path.join(updateDir(), "runner.json"), "utf8")) as Record<string, string | number | boolean>;
	const systemctlCalls = (): string[] => {
		const file = path.join(installDir, "systemctl.log");
		return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n") : [];
	};

	it("install and upgrade turn it on: watcher units, private log folder and the marker the app reads", () => {
		const result = runBash({ body: `${HELPER_STUBS}\nensure_update_helper` });
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Updates from the admin dashboard are on");

		const name = runBash({ body: "update_unit_name" }).stdout.trim();
		expect(name).toMatch(/^nextpress-update-\d+$/);
		const service = fs.readFileSync(path.join(installDir, "units", `${name}.service`), "utf8");
		const pathUnit = fs.readFileSync(path.join(installDir, "units", `${name}.path`), "utf8");
		expect(service).toContain(`ExecStart=/usr/local/bin/nextpress --install-dir ${installDir} update-runner`);
		expect(service).toContain("Type=oneshot");
		expect(pathUnit).toContain(`PathExists=${installDir}/update/request.json`);
		expect(pathUnit).toContain(`Unit=${name}.service`);
		expect(systemctlCalls()).toEqual(["systemctl daemon-reload", `systemctl enable --now ${name}.path`]);
		expect(readMarker()).toMatchObject({ protocol: 1, enabled: true, helper: "systemd", installDir });

		runBash({ body: `${HELPER_STUBS}\nensure_update_helper` });
		expect(systemctlCalls().filter((call) => call === "systemctl daemon-reload")).toHaveLength(1);
	});

	it("the default install keeps the plain unit name", () => {
		const result = runBash({ body: `INSTALL_DIR="$DEFAULT_INSTALL_DIR"\nupdate_unit_name` });
		expect(result.stdout.trim()).toBe("nextpress-update");
	});

	it("says plainly why it can't turn on, and never fails the install or upgrade", () => {
		const noSystemd = runBash({ body: `${HELPER_STUBS}\nensure_update_helper`, env: { FAKE_NO_SYSTEMD: "1" } });
		expect(noSystemd.code).toBe(0);
		expect(noSystemd.stdout).toContain("need systemd");
		const notRoot = runBash({ body: `${HELPER_STUBS}\nensure_update_helper`, env: { FAKE_NOT_ROOT: "1" } });
		expect(notRoot.stdout).toContain("sudo nextpress update-helper on");
		expect(fs.existsSync(path.join(updateDir(), "runner.json"))).toBe(false);
		expect(systemctlCalls()).toEqual([]);
	});

	it("off removes the watcher, drops a waiting request and tells the dashboard; upgrades keep it off", () => {
		runBash({ body: `${HELPER_STUBS}\nensure_update_helper` });
		writeRequest();
		const off = runBash({ body: `${HELPER_STUBS}\nrun_update_helper off` });
		expect(off.code).toBe(0);
		const name = runBash({ body: "update_unit_name" }).stdout.trim();
		expect(fs.existsSync(path.join(installDir, "units", `${name}.path`))).toBe(false);
		expect(fs.existsSync(path.join(updateDir(), "request.json"))).toBe(false);
		expect(readMarker()).toMatchObject({ enabled: false });
		expect(systemctlCalls()).toContain(`systemctl disable --now ${name}.path`);

		const upgrade = runBash({ body: `${HELPER_STUBS}\nensure_update_helper` });
		expect(upgrade.stdout).toContain("off on this server");
		expect(fs.existsSync(path.join(installDir, "units", `${name}.path`))).toBe(false);

		runBash({ body: `${HELPER_STUBS}\nrun_update_helper on` });
		expect(readMarker()).toMatchObject({ enabled: true });
		expect(fs.existsSync(path.join(installDir, ".update-helper-off"))).toBe(false);
	});

	it("refuses install paths that can't be written into a service file", () => {
		const result = runBash({ body: `${HELPER_STUBS}\nINSTALL_DIR="/opt/next press"\nupdate_helper_blocker` });
		expect(result.stdout).toContain("letters, numbers, dots, dashes and slashes");
	});
});

describe("upgrade command fixes on the same path", () => {
	let holder: ChildProcess | null = null;
	afterEach(() => {
		holder?.kill();
		holder = null;
	});

	it("a self-updating upgrade keeps the install dir it was given", () => {
		const bin = path.join(workDir, "bin");
		fs.mkdirSync(bin);
		fs.writeFileSync(path.join(bin, "nextpress"), "#!/usr/bin/env bash\necho old\n", { mode: 0o755 });
		const result = runBash({
			body: String.raw`
curl() { printf '#!/usr/bin/env bash\necho new\n' > "${"$"}{@: -1}"; }
exec() { echo "EXEC $*"; }
try_self_update_for_upgrade --version beta-v1.4.3`,
			env: { PATH: `${bin}:${process.env.PATH ?? ""}` },
		});
		expect(result.stdout).toContain(`EXEC ${path.join(bin, "nextpress")} --install-dir ${installDir} upgrade --version beta-v1.4.3`);
	});

	it("one upgrade at a time: a second one is refused while the lock is held", async () => {
		const lock = path.join(installDir, ".upgrade.lock");
		fs.writeFileSync(lock, "");
		// -o: the sleep child must not inherit the lock, so stopping flock frees it.
		holder = spawn("flock", ["-o", lock, "sleep", "20"], { stdio: "ignore" });
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			if (spawnSync("flock", ["-n", lock, "true"]).status === 1) break;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		expect(runBash({ body: "upgrade_lock_busy && echo busy || echo free" }).stdout.trim()).toBe("busy");
		const refused = runBash({ body: "acquire_upgrade_lock" });
		expect(refused.code).toBe(1);
		expect(refused.stderr).toContain("Another NextPress update is already running");

		holder.kill();
		await new Promise((resolve) => holder?.once("exit", resolve));
		holder = null;
		expect(runBash({ body: "upgrade_lock_busy && echo busy || echo free" }).stdout.trim()).toBe("free");
		expect(runBash({ body: "acquire_upgrade_lock && echo got-it" }).stdout.trim()).toBe("got-it");
	});

	it("still runs as a command after the guard that protects it from in-place replacement", () => {
		const result = spawnSync("bash", [SCRIPT, "version"], { encoding: "utf8", env: { ...process.env, BASH_ENV: "" } });
		expect(result.status).toBe(0);
		expect(result.stdout.trim()).toMatch(/^nextpress \d+\.\d+\.\d+$/);
	});
});

describe("contract with the app", () => {
	it("uses the same protocol and request age limit as the TypeScript side", () => {
		expect(SCRIPT_TEXT).toContain(`readonly UPDATE_PROTOCOL=${CORE_UPDATE_PROTOCOL}`);
		expect(SCRIPT_TEXT).toContain(`readonly UPDATE_REQUEST_MAX_AGE_SECONDS=${CORE_UPDATE_TIMING.requestMaxAgeMs / 1000}`);
	});

	it("only writes failure codes the dashboard can explain", () => {
		const finished = [...SCRIPT_TEXT.matchAll(/finish_update_run failed ([a-z_]+)/g)].map((match) => match[1]);
		const classified = [...SCRIPT_TEXT.matchAll(/printf '%s\\n' "([a-z_]+)"/g)].map((match) => match[1]);
		const fallbacks = [...SCRIPT_TEXT.matchAll(/classify_update_failure ([a-z_]+)\)/g)].map((match) => match[1]);
		const used = new Set([...finished, ...classified, ...fallbacks, "runner_error"]);
		expect(used.size).toBeGreaterThan(8);
		for (const code of used) {
			expect(CORE_UPDATE_FAILURE_CODES as readonly string[]).toContain(code);
		}
	});
});
