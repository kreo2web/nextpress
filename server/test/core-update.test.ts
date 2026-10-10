import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LatestVersionLookup } from "@shared/release/fetch-latest-version";
import type { CoreUpdateManageStatus, CoreUpdateRunnerStatusFile } from "@shared/core-update";
import type { Deps } from "../routes/shared/deps";
import { createCoreUpdateRoutes } from "../routes/core-update.routes";
import {
	createCoreUpdateService,
	createLatestReleaseLookup,
	createUpdateFolder,
	type LatestReleaseLookup,
} from "../lib/core-update";

const MAIN_SITE = { id: "site-main", ownerId: "owner-1", isDefault: true };
const OTHER_SITE = { id: "site-client", ownerId: "client-1", isDefault: false };
const ADMIN_ROLE = { id: "role-admin", name: "admin" };

/** Owner of the main site, an admin of another site only, and a plain subscriber. */
const models = {
	sites: {
		findDefaultSite: async () => MAIN_SITE,
		findById: async (id: string) => [MAIN_SITE, OTHER_SITE].find((site) => site.id === id),
	},
	roles: { findManyWhere: async () => [ADMIN_ROLE] },
	userRoles: {
		findByUser: async (userId: string) =>
			userId === "client-1" ? [{ userId, roleId: ADMIN_ROLE.id, siteId: OTHER_SITE.id }] : [],
	},
} as unknown as Pick<Deps["models"], "sites" | "roles" | "userRoles">;

const release = (latestVersion: string, checkOk = true): LatestVersionLookup => ({
	latestVersion,
	source: checkOk ? "github" : "bundled",
	checkedAt: "2026-10-10T12:00:00.000Z",
	checkOk,
	checkNote: "",
});

/** A release check that answers whatever the test sets, and counts forced checks. */
const createFakeLatest = (initial: LatestVersionLookup) => {
	let current = initial;
	let forced = 0;
	const lookup: LatestReleaseLookup = {
		get: async ({ force = false } = {}) => {
			if (force) forced += 1;
			return current;
		},
	};
	return { lookup, set: (next: LatestVersionLookup) => (current = next), forcedCount: () => forced };
};

const writeHelper = (dir: string, overrides: Record<string, string | number | boolean> = {}): void => {
	fs.writeFileSync(
		path.join(dir, "runner.json"),
		JSON.stringify({
			protocol: 1,
			enabled: true,
			helper: "systemd",
			installDir: "/opt/nextpress",
			cliVersion: "nextpress 1.4.3",
			updatedAt: "2026-10-10T11:00:00Z",
			...overrides,
		}),
	);
};

const readRequest = (dir: string): Record<string, string | number> | null => {
	const file = path.join(dir, "request.json");
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string | number>) : null;
};

describe("update folder", () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "np-update-folder-"));
	});
	afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

	it("reads a missing folder as 'no helper' and missing files as absent", async () => {
		expect(await createUpdateFolder({ dir: path.join(dir, "nope") }).read()).toEqual({
			folderExists: false,
			helper: null,
			request: null,
			status: null,
		});
		expect(await createUpdateFolder({ dir }).read()).toEqual({
			folderExists: true,
			helper: null,
			request: null,
			status: null,
		});
	});

	it("writes a request whole, one key per line, and leaves no temp file behind", async () => {
		const folder = createUpdateFolder({ dir });
		await folder.writeRequest({
			protocol: 1,
			requestId: "req-00000001",
			version: "1.4.3",
			requestedBy: "owner-1",
			requestedAt: "2026-10-10T12:00:00.000Z",
		});
		const text = fs.readFileSync(path.join(dir, "request.json"), "utf8");
		expect(text.split("\n")).toContain('  "version": "1.4.3",');
		expect(fs.readdirSync(dir)).toEqual(["request.json"]);
		const snapshot = await folder.read();
		expect(snapshot.request).toMatchObject({ requestId: "req-00000001", version: "1.4.3" });
		expect(Number.isNaN(Date.parse(snapshot.request?.writtenAt ?? ""))).toBe(false);
	});

	it("ignores links, oversized files and files of the wrong shape", async () => {
		const outside = path.join(dir, "outside.json");
		fs.writeFileSync(outside, JSON.stringify({ protocol: 1, enabled: true }));
		fs.symlinkSync(outside, path.join(dir, "runner.json"));
		fs.writeFileSync(path.join(dir, "status.json"), `{"protocol":1,"state":"running",${" ".repeat(70_000)}}`);
		fs.writeFileSync(path.join(dir, "request.json"), JSON.stringify({ protocol: 1, version: 7 }));
		expect(await createUpdateFolder({ dir }).read()).toEqual({
			folderExists: true,
			helper: null,
			request: null,
			status: null,
		});
	});
});

describe("latest release lookup", () => {
	it("reuses a good answer, shares one call between concurrent callers, and re-asks when forced", async () => {
		let calls = 0;
		let time = 0;
		const lookup = createLatestReleaseLookup({
			fallbackVersion: "1.4.2",
			now: () => time,
			fetchLatest: async () => {
				calls += 1;
				return release("1.4.3");
			},
		});
		await Promise.all([lookup.get(), lookup.get(), lookup.get()]);
		expect(calls).toBe(1);
		time += 10 * 60 * 1000;
		await lookup.get();
		expect(calls).toBe(1);
		await lookup.get({ force: true });
		expect(calls).toBe(2);
		time += 16 * 60 * 1000;
		await lookup.get();
		expect(calls).toBe(3);
	});

	it("asks again soon after a failed check instead of hiding updates for 15 minutes", async () => {
		let calls = 0;
		let time = 0;
		const lookup = createLatestReleaseLookup({
			fallbackVersion: "1.4.2",
			now: () => time,
			fetchLatest: async () => {
				calls += 1;
				return release("1.4.2", false);
			},
		});
		await lookup.get();
		time += 3 * 60 * 1000;
		await lookup.get();
		expect(calls).toBe(2);
	});
});

describe("one-click update routes", () => {
	let dir: string;
	let server: Server;
	let baseUrl: string;
	let latest: ReturnType<typeof createFakeLatest>;
	let installedVersion: string;
	let requestIds: number;

	const call = async ({
		method,
		route,
		user,
		body,
	}: {
		method: "GET" | "POST";
		route: string;
		user?: string;
		body?: Record<string, string>;
	}): Promise<{ status: number; json: Record<string, unknown> }> => {
		const res = await fetch(`${baseUrl}/api/system/update${route}`, {
			method,
			headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		return { status: res.status, json: (await res.json()) as Record<string, unknown> };
	};

	const start = (user: string, overrides: Record<string, string> = {}) =>
		call({ method: "POST", route: "/start", user, body: { password: "right-password", expectedVersion: "1.4.3", ...overrides } });

	beforeEach(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "np-update-routes-"));
		writeHelper(dir);
		latest = createFakeLatest(release("1.4.3"));
		installedVersion = "1.4.2";
		requestIds = 0;

		const app = express();
		app.use(express.json());
		app.use(
			"/api/system/update",
			createCoreUpdateRoutes({
				models,
				requireSession: (req, res, next) => {
					if (!req.get("x-test-user")) {
						res.status(401).json({ message: "Unauthorized" });
						return;
					}
					next();
				},
				getUserId: (req) => req.get("x-test-user") ?? null,
				verifyPassword: async ({ password }) => password === "right-password",
				service: createCoreUpdateService({
					folder: createUpdateFolder({ dir }),
					latest: latest.lookup,
					nodeEnv: "production",
					readInstalledVersion: () => installedVersion,
					now: () => new Date(),
					newRequestId: () => `req-${String((requestIds += 1)).padStart(8, "0")}`,
				}),
			}),
		);
		server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterEach(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("shows update details only to the main site's admins", async () => {
		expect((await call({ method: "GET", route: "/status" })).status).toBe(401);
		expect((await call({ method: "GET", route: "/status", user: "subscriber-1" })).json).toEqual({ canManage: false });
		expect((await call({ method: "GET", route: "/status", user: "client-1" })).json).toEqual({ canManage: false });

		const { json } = await call({ method: "GET", route: "/status", user: "owner-1" });
		const status = json as CoreUpdateManageStatus;
		expect(status).toMatchObject({
			canManage: true,
			installedVersion: "1.4.2",
			latestVersion: "1.4.3",
			updateAvailable: true,
			availability: { ready: true },
			run: null,
		});
	});

	it("refuses anyone but the main site's admins, before looking at the password", async () => {
		const { status, json } = await start("client-1");
		expect(status).toBe(403);
		expect(json.code).toBe("not_allowed");
		expect(readRequest(dir)).toBeNull();
	});

	it("refuses a wrong password and writes nothing", async () => {
		const { status, json } = await start("owner-1", { password: "guess" });
		expect(status).toBe(403);
		expect(json).toMatchObject({ code: "wrong_password", message: "That password isn't right. Try again." });
		expect(readRequest(dir)).toBeNull();
	});

	it("refuses a body without a password or with a made-up version", async () => {
		expect((await call({ method: "POST", route: "/start", user: "owner-1", body: { expectedVersion: "1.4.3" } })).status).toBe(400);
		expect((await start("owner-1", { expectedVersion: "../../latest" })).status).toBe(400);
		expect(readRequest(dir)).toBeNull();
	});

	it("leaves one request for the server's own latest version and answers 202", async () => {
		const { status, json } = await start("owner-1");
		expect(status).toBe(202);
		expect(json.started).toBe(true);
		expect((json.status as CoreUpdateManageStatus).run).toMatchObject({ state: "requested", requestId: "req-00000001" });
		expect(readRequest(dir)).toMatchObject({ protocol: 1, requestId: "req-00000001", version: "1.4.3", requestedBy: "owner-1" });
		expect(latest.forcedCount()).toBe(1);
	});

	it("never starts a second run: repeated and simultaneous starts get the same request back", async () => {
		const [first, second] = await Promise.all([start("owner-1"), start("owner-1")]);
		expect([first.status, second.status]).toEqual([202, 202]);
		expect([first.json.started, second.json.started].sort()).toEqual([false, true]);
		expect(readRequest(dir)?.requestId).toBe("req-00000001");

		const third = await start("owner-1");
		expect(third.json.started).toBe(false);
		expect(requestIds).toBe(1);
	});

	it("treats a running update as in progress too", async () => {
		const running: CoreUpdateRunnerStatusFile = {
			protocol: 1,
			state: "running",
			code: "running",
			step: "install",
			requestId: "req-earlier",
			version: "1.4.3",
			fromTag: "beta-v1.4.2",
			startedAt: new Date().toISOString(),
			finishedAt: "",
			logPath: "/opt/nextpress/update-logs/update-x.log",
			siteRestored: false,
		};
		fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(running));
		const { status, json } = await start("owner-1");
		expect(status).toBe(202);
		expect(json.started).toBe(false);
		expect(readRequest(dir)).toBeNull();
	});

	it("asks for a fresh review when a newer version came out after the review", async () => {
		latest.set(release("1.4.4"));
		const { status, json } = await start("owner-1");
		expect(status).toBe(409);
		expect(json.code).toBe("version_changed");
		expect((json.status as CoreUpdateManageStatus).latestVersion).toBe("1.4.4");
		expect(readRequest(dir)).toBeNull();
	});

	it("refuses when already up to date or when the release check failed", async () => {
		installedVersion = "1.4.3";
		expect((await start("owner-1")).json.code).toBe("up_to_date");
		installedVersion = "1.4.2";
		latest.set(release("1.4.2", false));
		const failed = await start("owner-1");
		expect(failed.status).toBe(503);
		expect(failed.json.code).toBe("check_failed");
		expect(readRequest(dir)).toBeNull();
	});

	it("explains, with the one command to run, when the server can't update itself", async () => {
		fs.rmSync(path.join(dir, "runner.json"));
		const missing = await start("owner-1");
		expect(missing.status).toBe(409);
		expect(missing.json.code).toBe("not_ready");
		expect((missing.json.status as CoreUpdateManageStatus).manualCommand).toBe(
			"sudo nextpress upgrade --version beta-v1.4.3",
		);

		writeHelper(dir, { enabled: false, installDir: "/srv/np" });
		const off = await call({ method: "GET", route: "/status", user: "owner-1" });
		expect((off.json as CoreUpdateManageStatus).availability).toMatchObject({ ready: false, blocker: "helper_off" });
		expect((off.json as CoreUpdateManageStatus).manualCommand).toBe(
			"sudo nextpress --install-dir /srv/np upgrade --version beta-v1.4.3",
		);
		expect((await start("owner-1")).json.code).toBe("not_ready");
		expect(readRequest(dir)).toBeNull();
	});

	it("caps tries per person, wrong passwords included", async () => {
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect((await start("owner-1", { password: "guess" })).status).toBe(403);
		}
		const capped = await start("owner-1");
		expect(capped.status).toBe(429);
		expect(capped.json.code).toBe("rate_limited");
		expect(readRequest(dir)).toBeNull();
	});

	it("reports the runner's progress for the request it picked up", async () => {
		await start("owner-1");
		const done: CoreUpdateRunnerStatusFile = {
			protocol: 1,
			state: "done",
			code: "updated",
			step: "",
			requestId: "req-00000001",
			version: "1.4.3",
			fromTag: "beta-v1.4.2",
			startedAt: new Date().toISOString(),
			finishedAt: new Date().toISOString(),
			logPath: "/opt/nextpress/update-logs/update-x.log",
			siteRestored: false,
		};
		fs.rmSync(path.join(dir, "request.json"));
		fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(done));
		const { json } = await call({ method: "GET", route: "/status", user: "owner-1" });
		expect((json as CoreUpdateManageStatus).run).toMatchObject({
			state: "done",
			requestId: "req-00000001",
			message: "NextPress 1.4.3 is installed.",
			fromVersion: "1.4.2",
		});
	});
});
