import { isSemverNewer } from "../release/semver";
import { humanizeDuration } from "./humanize-duration";
import {
	describeUpdateBlocker,
	describeUpdateDone,
	describeUpdateFailure,
	describeUpdateProgress,
	failedWhileInstalling,
} from "./messages";
import { buildManualUpdateCommand, releaseNotesUrl, versionFromImageTag } from "./release-tag";
import {
	CORE_UPDATE_PROTOCOL,
	type CoreUpdateAvailability,
	type CoreUpdateFolderSnapshot,
	type CoreUpdatePendingRequest,
	type CoreUpdateRun,
	type CoreUpdateRunnerStatusFile,
	type CoreUpdateStatus,
	type CoreUpdateStep,
} from "./types";

/** Timings shared by the app and the browser. */
export const CORE_UPDATE_TIMING = {
	/** A request still waiting after this shows a hint with the manual command. */
	pickupHintMs: 60_000,
	/**
	 * Requests older than this are refused by the server runner, so the app reports them as not picked up.
	 * Keep equal to UPDATE_REQUEST_MAX_AGE_SECONDS in scripts/nextpress.
	 */
	requestMaxAgeMs: 5 * 60_000,
	/** A run still going after this is reported as slow. */
	runningSlowMs: 30 * 60_000,
	/** Typical time the sites are offline while the new version installs and restarts. */
	typicalDowntimeMs: 2 * 60_000,
} as const;

const ageMs = ({ since, now }: { since: string; now: Date }): number => {
	const at = Date.parse(since);
	return Number.isFinite(at) ? now.getTime() - at : 0;
};

const toStep = (step: string): CoreUpdateStep | null =>
	step === "waiting" || step === "download" || step === "install" ? step : null;

const orNull = (value: string): string | null => (value.trim() === "" ? null : value);

/** A request the app wrote that the runner has not answered yet. */
const runFromRequest = ({ request, now }: { request: CoreUpdatePendingRequest; now: Date }): CoreUpdateRun => {
	const age = ageMs({ since: request.writtenAt, now });
	const base = {
		requestId: request.requestId,
		version: request.version,
		fromVersion: null,
		startedAt: request.requestedAt,
		logPath: null,
	};

	if (age > CORE_UPDATE_TIMING.requestMaxAgeMs) {
		return {
			...base,
			state: "failed",
			step: null,
			code: "not_picked_up",
			message: describeUpdateFailure("not_picked_up"),
			finishedAt: null,
			failedWhileInstalling: false,
			slow: false,
		};
	}

	const slow = age > CORE_UPDATE_TIMING.pickupHintMs;
	return {
		...base,
		state: "requested",
		step: "waiting",
		code: "requested",
		message: describeUpdateProgress({ state: "requested", step: "", version: request.version, slow }),
		finishedAt: null,
		failedWhileInstalling: false,
		slow,
	};
};

/** What the runner last wrote, in dashboard terms. */
const runFromStatus = ({ status, now }: { status: CoreUpdateRunnerStatusFile; now: Date }): CoreUpdateRun => {
	const base = {
		requestId: status.requestId,
		version: status.version,
		fromVersion: versionFromImageTag(status.fromTag),
		code: status.code,
		startedAt: orNull(status.startedAt),
		finishedAt: orNull(status.finishedAt),
		logPath: orNull(status.logPath),
	};

	if (status.state === "running") {
		const slow = ageMs({ since: status.startedAt, now }) > CORE_UPDATE_TIMING.runningSlowMs;
		return {
			...base,
			state: "running",
			step: toStep(status.step) ?? "install",
			message: describeUpdateProgress({ state: "running", step: status.step, version: status.version, slow }),
			failedWhileInstalling: false,
			slow,
		};
	}

	if (status.state === "done") {
		return {
			...base,
			state: "done",
			step: null,
			message: describeUpdateDone(status.version),
			failedWhileInstalling: false,
			slow: false,
		};
	}

	return {
		...base,
		state: "failed",
		step: null,
		message: describeUpdateFailure(status.code),
		failedWhileInstalling: failedWhileInstalling(status.code),
		slow: false,
	};
};

/**
 * The current or last run. A waiting request wins over an older status; once the runner has written a status
 * for that request, the status tells the story.
 */
export const deriveCoreUpdateRun = ({
	folder,
	now,
}: {
	folder: CoreUpdateFolderSnapshot;
	now: Date;
}): CoreUpdateRun | null => {
	const { request, status } = folder;
	if (request) {
		if (status && status.requestId === request.requestId) return runFromStatus({ status, now });
		return runFromRequest({ request, now });
	}
	return status ? runFromStatus({ status, now }) : null;
};

/** Whether this install can update itself from the dashboard, and if not, why. */
export const deriveCoreUpdateAvailability = ({
	nodeEnv,
	folder,
}: {
	nodeEnv: string;
	folder: CoreUpdateFolderSnapshot;
}): CoreUpdateAvailability => {
	const blocked = (blocker: Exclude<CoreUpdateAvailability, { ready: true }>["blocker"]): CoreUpdateAvailability => ({
		ready: false,
		blocker,
		message: describeUpdateBlocker(blocker),
	});

	if (nodeEnv !== "production") return blocked("development");
	if (!folder.folderExists || !folder.helper) return blocked("no_helper");
	if (folder.helper.protocol !== CORE_UPDATE_PROTOCOL) return blocked("helper_outdated");
	if (!folder.helper.enabled) return blocked("helper_off");
	return { ready: true };
};

/** True while a run is waiting for the runner or running: a new start must not create a second one. */
export const isCoreUpdateRunActive = (run: CoreUpdateRun | null): boolean =>
	run !== null && (run.state === "requested" || run.state === "running");

/**
 * Builds the dashboard status from what the server knows. Pure, so the same rules are tested without files,
 * clocks or network.
 */
export const deriveCoreUpdateStatus = ({
	canManage,
	nodeEnv,
	installedVersion,
	latest,
	folder,
	now,
}: {
	canManage: boolean;
	nodeEnv: string;
	installedVersion: string;
	latest: { latestVersion: string; checkOk: boolean; checkedAt: string };
	folder: CoreUpdateFolderSnapshot;
	now: Date;
}): CoreUpdateStatus => {
	if (!canManage) return { canManage: false };

	const latestVersion = latest.checkOk ? latest.latestVersion : null;
	const availability = deriveCoreUpdateAvailability({ nodeEnv, folder });
	const isDevelopment = !availability.ready && availability.blocker === "development";

	return {
		canManage: true,
		installedVersion,
		latestVersion,
		updateAvailable: latestVersion !== null && isSemverNewer({ current: installedVersion, candidate: latestVersion }),
		checkOk: latest.checkOk,
		checkedAt: latest.checkedAt,
		releaseNotesUrl: latestVersion ? releaseNotesUrl(latestVersion) : null,
		availability,
		manualCommand: isDevelopment
			? null
			: buildManualUpdateCommand({ version: latestVersion, installDir: folder.helper?.installDir ?? null }),
		downtime: humanizeDuration(CORE_UPDATE_TIMING.typicalDowntimeMs),
		run: deriveCoreUpdateRun({ folder, now }),
	};
};
