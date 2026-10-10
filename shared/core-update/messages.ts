import type { CoreUpdateBlocker } from "./types";

/**
 * Codes the host runner (scripts/nextpress) writes for a failed update, plus the two the app derives itself
 * (`not_picked_up`, and `requested` while waiting). Keep in step with `finish_update_run` and
 * `classify_update_failure` in scripts/nextpress; a test reads the script to check.
 */
export const CORE_UPDATE_FAILURE_CODES = [
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
] as const;

export type CoreUpdateFailureCode = (typeof CORE_UPDATE_FAILURE_CODES)[number];

/** Failures that happen after the sites went offline for the install step. */
const INSTALL_PHASE_FAILURES = new Set<string>([
	"low_disk",
	"needs_manual_step",
	"backup_failed",
	"health_check_failed",
	"upgrade_failed",
	"interrupted",
	"runner_error",
]);

const FAILURE_MESSAGES: Record<CoreUpdateFailureCode, string> = {
	bad_request: "The server couldn't read the update request, so nothing was changed. Start the update again.",
	expired: "The update request waited too long and was dropped, so nothing was changed. Start the update again.",
	busy: "Another update was already running on the server. Try again once it has finished.",
	release_check_failed:
		"The server couldn't check for new versions, so nothing was changed. Try again in a few minutes.",
	not_latest: "A newer version came out in the meantime, so nothing was changed. Review it and start again.",
	download_failed: "The new version couldn't be downloaded, so nothing was installed. Try again later.",
	low_disk: "The server is running out of disk space. Free up some space on the server, then try again.",
	needs_manual_step: "This version can't be installed from the dashboard. Run the command below on the server.",
	backup_failed:
		"The copy of your database couldn't be saved, so the update stopped before changing it. Run the command below on the server to see why.",
	health_check_failed: "The new version didn't start properly.",
	upgrade_failed: "The update didn't finish.",
	interrupted: "The update was interrupted before it finished.",
	runner_error: "The update stopped because of a problem on the server.",
	not_picked_up:
		"The server didn't start the update. Run the command below on the server, or turn on dashboard updates there.",
};

const BLOCKER_MESSAGES: Record<CoreUpdateBlocker, string> = {
	development: "This copy of NextPress runs in development mode. Update it from your code, then restart it.",
	no_helper:
		"This server can't update itself from here yet. Run the command below on the server once. After that, updates work from this dashboard.",
	helper_off: "Updates from the dashboard are turned off on this server. Run the command below on the server instead.",
	helper_outdated:
		"The server's update helper is out of date. Run the command below on the server once to refresh it.",
};

const isFailureCode = (code: string): code is CoreUpdateFailureCode =>
	(CORE_UPDATE_FAILURE_CODES as readonly string[]).includes(code);

/** Plain-language outcome of a failed update. Unknown codes get the general message. */
export const describeUpdateFailure = (code: string): string =>
	isFailureCode(code) ? FAILURE_MESSAGES[code] : FAILURE_MESSAGES.upgrade_failed;

/** True when the sites had already gone offline for the install step when the update failed. */
export const failedWhileInstalling = (code: string): boolean =>
	INSTALL_PHASE_FAILURES.has(code) || !isFailureCode(code);

/** Why the dashboard can't update this install, with the next step in plain words. */
export const describeUpdateBlocker = (blocker: CoreUpdateBlocker): string => BLOCKER_MESSAGES[blocker];

/** Progress lines for a run that has not finished. */
export const describeUpdateProgress = ({
	state,
	step,
	version,
	slow,
}: {
	state: "requested" | "running";
	step: string;
	version: string;
	slow: boolean;
}): string => {
	if (state === "requested") {
		return slow
			? "The server hasn't started the update yet. If nothing happens soon, run the command below on the server."
			: "Waiting for the server to start the update.";
	}
	if (slow) return "This update is taking much longer than usual. Whoever looks after the server can check the update log.";
	if (step === "waiting") return `Getting NextPress ${version} ready. Your sites are still online.`;
	if (step === "download") return `Downloading NextPress ${version}. Your sites are still online.`;
	return `Installing NextPress ${version}. Your sites are offline for a moment.`;
};

/** Outcome line of a finished update (shown briefly; the page reloads into What's New). */
export const describeUpdateDone = (version: string): string => `NextPress ${version} is installed.`;
