import { describe, expect, it } from "vitest";
import {
	CORE_UPDATE_TIMING,
	buildManualUpdateCommand,
	deriveCoreUpdateStatus,
	describeUpdateFailure,
	humanizeDuration,
	isCoreUpdateRunActive,
	releaseImageTag,
	versionFromImageTag,
	type CoreUpdateFolderSnapshot,
	type CoreUpdateManageStatus,
	type CoreUpdateRunnerStatusFile,
} from "./index";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const minutesAgo = (minutes: number): string => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const readyFolder = (overrides: Partial<CoreUpdateFolderSnapshot> = {}): CoreUpdateFolderSnapshot => ({
	folderExists: true,
	helper: {
		protocol: 1,
		enabled: true,
		helper: "systemd",
		installDir: "/opt/nextpress",
		cliVersion: "nextpress 1.4.3",
		updatedAt: minutesAgo(60),
	},
	request: null,
	status: null,
	...overrides,
});

const runnerStatus = (overrides: Partial<CoreUpdateRunnerStatusFile> = {}): CoreUpdateRunnerStatusFile => ({
	protocol: 1,
	state: "running",
	code: "running",
	step: "download",
	requestId: "req-00000001",
	version: "1.4.3",
	fromTag: "beta-v1.4.2",
	startedAt: minutesAgo(1),
	finishedAt: "",
	logPath: "/opt/nextpress/update-logs/update-20261010-115900.log",
	siteRestored: false,
	...overrides,
});

const latest = { latestVersion: "1.4.3", checkOk: true, checkedAt: NOW.toISOString() };

const manage = (status: ReturnType<typeof deriveCoreUpdateStatus>): CoreUpdateManageStatus => {
	if (!status.canManage) throw new Error("expected a manage status");
	return status;
};

const derive = (params: Partial<Parameters<typeof deriveCoreUpdateStatus>[0]> = {}): CoreUpdateManageStatus =>
	manage(
		deriveCoreUpdateStatus({
			canManage: true,
			nodeEnv: "production",
			installedVersion: "1.4.2",
			latest,
			folder: readyFolder(),
			now: NOW,
			...params,
		}),
	);

describe("release tags and commands", () => {
	it("maps a release to the Docker Hub tag deploy.sh publishes, and back", () => {
		expect(releaseImageTag("1.4.3")).toBe("beta-v1.4.3");
		expect(versionFromImageTag("beta-v1.4.1")).toBe("1.4.1");
		expect(versionFromImageTag("latest")).toBeNull();
	});

	it("builds the one manual command, naming a custom install folder only when there is one", () => {
		expect(buildManualUpdateCommand({ version: "1.4.3", installDir: "/opt/nextpress" })).toBe(
			"sudo nextpress upgrade --version beta-v1.4.3",
		);
		expect(buildManualUpdateCommand({ version: "1.4.3", installDir: "/srv/np" })).toBe(
			"sudo nextpress --install-dir /srv/np upgrade --version beta-v1.4.3",
		);
		expect(buildManualUpdateCommand({ version: null, installDir: null })).toBe("sudo nextpress upgrade");
	});
});

describe("humanizeDuration", () => {
	it("speaks in rounded words, never milliseconds", () => {
		expect(humanizeDuration(3_000)).toBe("a few seconds");
		expect(humanizeDuration(30_000)).toBe("less than a minute");
		expect(humanizeDuration(70_000)).toBe("about a minute");
		expect(humanizeDuration(CORE_UPDATE_TIMING.typicalDowntimeMs)).toBe("about 2 minutes");
		expect(humanizeDuration(3 * 3_600_000)).toBe("about 3 hours");
	});
});

describe("deriveCoreUpdateStatus", () => {
	it("tells people who cannot manage updates nothing else", () => {
		expect(
			deriveCoreUpdateStatus({
				canManage: false,
				nodeEnv: "production",
				installedVersion: "1.4.2",
				latest,
				folder: readyFolder(),
				now: NOW,
			}),
		).toEqual({ canManage: false });
	});

	it("offers a newer official release when the server helper is listening", () => {
		const status = derive();
		expect(status.updateAvailable).toBe(true);
		expect(status.availability).toEqual({ ready: true });
		expect(status.releaseNotesUrl).toBe("https://github.com/nextpress-ai/nextpress/releases/tag/v1.4.3");
		expect(status.manualCommand).toBe("sudo nextpress upgrade --version beta-v1.4.3");
		expect(status.downtime).toBe("about 2 minutes");
		expect(status.run).toBeNull();
	});

	it("never claims an update when the release check failed", () => {
		const status = derive({ latest: { latestVersion: "1.4.2", checkOk: false, checkedAt: NOW.toISOString() } });
		expect(status.latestVersion).toBeNull();
		expect(status.updateAvailable).toBe(false);
		expect(status.manualCommand).toBe("sudo nextpress upgrade");
	});

	it("explains each reason the install cannot update itself", () => {
		const blockerOf = (status: CoreUpdateManageStatus): string | null =>
			status.availability.ready ? null : status.availability.blocker;

		expect(blockerOf(derive({ nodeEnv: "development" }))).toBe("development");
		expect(derive({ nodeEnv: "development" }).manualCommand).toBeNull();
		expect(blockerOf(derive({ folder: readyFolder({ folderExists: false, helper: null }) }))).toBe("no_helper");
		expect(blockerOf(derive({ folder: readyFolder({ helper: null }) }))).toBe("no_helper");
		const off = readyFolder();
		expect(blockerOf(derive({ folder: { ...off, helper: { ...off.helper!, enabled: false } } }))).toBe("helper_off");
		expect(blockerOf(derive({ folder: { ...off, helper: { ...off.helper!, protocol: 2 } } }))).toBe(
			"helper_outdated",
		);
	});

	it("shows a fresh request as waiting, then hints, then reports it was not picked up", () => {
		const requestAt = (minutes: number) =>
			readyFolder({
				request: {
					protocol: 1,
					requestId: "req-00000002",
					version: "1.4.3",
					requestedBy: "user-1",
					requestedAt: minutesAgo(minutes),
					writtenAt: minutesAgo(minutes),
				},
			});

		const fresh = derive({ folder: requestAt(0) }).run;
		expect(fresh).toMatchObject({ state: "requested", step: "waiting", slow: false });
		expect(isCoreUpdateRunActive(fresh)).toBe(true);

		expect(derive({ folder: requestAt(2) }).run).toMatchObject({ state: "requested", slow: true });

		const stale = derive({ folder: requestAt(6) }).run;
		expect(stale).toMatchObject({ state: "failed", code: "not_picked_up" });
		expect(isCoreUpdateRunActive(stale)).toBe(false);
	});

	it("lets the runner's status speak once it has answered the waiting request", () => {
		const folder = readyFolder({
			request: {
				protocol: 1,
				requestId: "req-00000001",
				version: "1.4.3",
				requestedBy: "user-1",
				requestedAt: minutesAgo(1),
				writtenAt: minutesAgo(1),
			},
			status: runnerStatus(),
		});
		const run = derive({ folder }).run;
		expect(run).toMatchObject({ state: "running", step: "download", fromVersion: "1.4.2" });
		expect(run?.message).toContain("Your sites are still online");
	});

	it("shows a run the server is still checking as getting ready, with the sites online", () => {
		const run = derive({ folder: readyFolder({ status: runnerStatus({ step: "waiting" }) }) }).run;
		expect(run).toMatchObject({ state: "running", step: "waiting" });
		expect(run?.message).toBe("Getting NextPress 1.4.3 ready. Your sites are still online.");
		expect(isCoreUpdateRunActive(run)).toBe(true);
	});

	it("reports a long-running install as slow", () => {
		const run = derive({ folder: readyFolder({ status: runnerStatus({ step: "install", startedAt: minutesAgo(45) }) }) }).run;
		expect(run).toMatchObject({ state: "running", step: "install", slow: true });
	});

	it("explains a failed run in plain words and says whether the sites were offline", () => {
		const run = derive({
			folder: readyFolder({
				status: runnerStatus({ state: "failed", code: "low_disk", step: "", finishedAt: minutesAgo(0) }),
			}),
		}).run;
		expect(run).toMatchObject({ state: "failed", code: "low_disk", failedWhileInstalling: true });
		expect(run?.message).toBe(describeUpdateFailure("low_disk"));

		const download = derive({
			folder: readyFolder({ status: runnerStatus({ state: "failed", code: "download_failed", step: "" }) }),
		}).run;
		expect(download?.failedWhileInstalling).toBe(false);
	});

	it("falls back to a general message for a code it does not know", () => {
		expect(describeUpdateFailure("something_new")).toBe(describeUpdateFailure("upgrade_failed"));
	});

	it("never leaks internal words into the failure messages", () => {
		const codes = [
			"bad_request",
			"expired",
			"busy",
			"release_check_failed",
			"not_latest",
			"download_failed",
			"low_disk",
			"needs_manual_step",
			"backup_failed",
			"health_check_failed",
			"upgrade_failed",
			"interrupted",
			"runner_error",
			"not_picked_up",
		];
		for (const code of codes) {
			expect(describeUpdateFailure(code)).not.toMatch(/docker|systemd|compose|json|runner|exit code|stack/i);
		}
	});
});
