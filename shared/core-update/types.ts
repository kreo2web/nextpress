/**
 * Contract between the app, the browser and the host-side update runner (`nextpress update-runner` in
 * scripts/nextpress). The app and the runner only talk through three small files in a shared folder:
 *
 * - `request.json` — written by the app when an admin confirms an update.
 * - `status.json`  — written by the runner while it works and when it finishes.
 * - `runner.json`  — written by `nextpress update-helper on|off` so the app knows whether anyone is listening.
 *
 * Bump CORE_UPDATE_PROTOCOL (here and `UPDATE_PROTOCOL` in scripts/nextpress) together when a file changes shape.
 */
export const CORE_UPDATE_PROTOCOL = 1;

/** What the app writes to `request.json`. Pretty-printed, one key per line, so the bash runner can read it. */
export type CoreUpdateRequestFile = {
	protocol: number;
	requestId: string;
	version: string;
	requestedBy: string;
	requestedAt: string;
};

/** States the runner writes. `requested` is never in the file: the app derives it from a waiting request. */
export type CoreUpdateRunnerState = "running" | "done" | "failed";

/** What the runner writes to `status.json`. Empty strings mean "not known". */
export type CoreUpdateRunnerStatusFile = {
	protocol: number;
	state: CoreUpdateRunnerState;
	code: string;
	step: string;
	requestId: string;
	version: string;
	fromTag: string;
	startedAt: string;
	finishedAt: string;
	logPath: string;
	siteRestored: boolean;
};

/** What `nextpress update-helper on|off` writes to `runner.json`. */
export type CoreUpdateHelperFile = {
	protocol: number;
	enabled: boolean;
	helper: string;
	installDir: string;
	cliVersion: string;
	updatedAt: string;
};

/** A waiting request plus when it was written (file time), so the app can tell when it went stale. */
export type CoreUpdatePendingRequest = CoreUpdateRequestFile & { writtenAt: string };

/** Everything the server read from the shared folder at one moment. */
export type CoreUpdateFolderSnapshot = {
	folderExists: boolean;
	helper: CoreUpdateHelperFile | null;
	request: CoreUpdatePendingRequest | null;
	status: CoreUpdateRunnerStatusFile | null;
};

export type CoreUpdateRunState = "requested" | "running" | "done" | "failed";

/** Where a running update is: still waiting for the server, downloading (site online), or installing. */
export type CoreUpdateStep = "waiting" | "download" | "install";

/** The current or last update, in the shape the dashboard shows. */
export type CoreUpdateRun = {
	requestId: string;
	state: CoreUpdateRunState;
	step: CoreUpdateStep | null;
	version: string;
	/** Version the install ran before this update, when the runner could tell. */
	fromVersion: string | null;
	code: string;
	/** Plain-language outcome with a next step. */
	message: string;
	startedAt: string | null;
	finishedAt: string | null;
	/** Host path of the update log, for whoever looks after the server. */
	logPath: string | null;
	/** True when the failure happened while installing (after the site went offline). */
	failedWhileInstalling: boolean;
	/** Waiting much longer than it should: not picked up yet, or still running after a long time. */
	slow: boolean;
};

/** Why this install cannot update itself from the dashboard right now. */
export type CoreUpdateBlocker = "development" | "no_helper" | "helper_off" | "helper_outdated";

export type CoreUpdateAvailability =
	| { ready: true }
	| { ready: false; blocker: CoreUpdateBlocker; message: string };

/** Status for people who may update NextPress (main-site admins). */
export type CoreUpdateManageStatus = {
	canManage: true;
	installedVersion: string;
	/** Newest official release, or null when the release check failed. */
	latestVersion: string | null;
	updateAvailable: boolean;
	checkOk: boolean;
	checkedAt: string;
	releaseNotesUrl: string | null;
	availability: CoreUpdateAvailability;
	/** The one command to run on the server instead. Null in development. */
	manualCommand: string | null;
	/** Rough time the sites are offline, in words ("about 2 minutes"). */
	downtime: string;
	run: CoreUpdateRun | null;
};

/** `GET /api/system/update/status`. Everyone else only learns that they cannot manage updates. */
export type CoreUpdateStatus = { canManage: false } | CoreUpdateManageStatus;

/** Machine codes on refused `POST /api/system/update/start` calls (the message is for people). */
export type CoreUpdateStartErrorCode =
	| "not_allowed"
	| "rate_limited"
	| "invalid_request"
	| "wrong_password"
	| "not_ready"
	| "check_failed"
	| "up_to_date"
	| "version_changed"
	| "start_failed";
