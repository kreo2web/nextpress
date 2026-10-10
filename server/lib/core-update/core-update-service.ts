import { randomUUID } from "node:crypto";
import {
	CORE_UPDATE_PROTOCOL,
	deriveCoreUpdateStatus,
	isCoreUpdateRunActive,
	type CoreUpdateManageStatus,
	type CoreUpdateStartErrorCode,
} from "@shared/core-update";
import { isSemverNewer } from "@shared/release/semver";
import type { LatestVersionLookup } from "@shared/release/fetch-latest-version";
import type { UpdateFolder } from "./update-folder";
import type { LatestReleaseLookup } from "./latest-release";

export type StartCoreUpdateResult =
	| { ok: true; started: boolean; status: CoreUpdateManageStatus }
	| { ok: false; code: CoreUpdateStartErrorCode; message: string; status: CoreUpdateManageStatus | null };

export type CoreUpdateService = {
	/** Dashboard status for a main-site admin. */
	getStatus: () => Promise<CoreUpdateManageStatus>;
	/**
	 * Leaves an update request for the host runner, after the caller has checked who is asking and their
	 * password. Never starts a second run while one is waiting or running: that call gets the current run back.
	 */
	start: (params: { userId: string; expectedVersion: string }) => Promise<StartCoreUpdateResult>;
};

const asManage = (status: ReturnType<typeof deriveCoreUpdateStatus>): CoreUpdateManageStatus => {
	if (!status.canManage) throw new Error("Core update status was built for someone who cannot manage updates");
	return status;
};

/** Update rules on top of the shared folder and the release check. Clock, ids and files are injected for tests. */
export function createCoreUpdateService({
	folder,
	latest,
	nodeEnv,
	readInstalledVersion,
	now = () => new Date(),
	newRequestId = randomUUID,
}: {
	folder: UpdateFolder;
	latest: LatestReleaseLookup;
	nodeEnv: string;
	readInstalledVersion: () => string;
	now?: () => Date;
	newRequestId?: () => string;
}): CoreUpdateService {
	// Starts run one after another inside this process, so two clicks can't both write a request.
	let startQueue: Promise<void> = Promise.resolve();

	const buildStatus = async (release?: LatestVersionLookup): Promise<CoreUpdateManageStatus> => {
		const [snapshot, lookup] = await Promise.all([folder.read(), release ? Promise.resolve(release) : latest.get()]);
		return asManage(
			deriveCoreUpdateStatus({
				canManage: true,
				nodeEnv,
				installedVersion: readInstalledVersion(),
				latest: lookup,
				folder: snapshot,
				now: now(),
			}),
		);
	};

	const startNow = async ({
		userId,
		expectedVersion,
	}: {
		userId: string;
		expectedVersion: string;
	}): Promise<StartCoreUpdateResult> => {
		const before = await buildStatus();
		if (isCoreUpdateRunActive(before.run)) return { ok: true, started: false, status: before };
		if (!before.availability.ready) {
			return { ok: false, code: "not_ready", message: before.availability.message, status: before };
		}

		// Ask GitHub again: the version installed must be the newest official release right now.
		const release = await latest.get({ force: true });
		const fresh = await buildStatus(release);
		if (!release.checkOk || !fresh.latestVersion) {
			return {
				ok: false,
				code: "check_failed",
				message: "NextPress couldn't check for new versions. Try again in a few minutes.",
				status: fresh,
			};
		}
		if (!isSemverNewer({ current: fresh.installedVersion, candidate: fresh.latestVersion })) {
			return { ok: false, code: "up_to_date", message: "NextPress is already up to date.", status: fresh };
		}
		if (fresh.latestVersion !== expectedVersion) {
			return {
				ok: false,
				code: "version_changed",
				message: `NextPress ${fresh.latestVersion} came out in the meantime. Review it, then start the update again.`,
				status: fresh,
			};
		}

		const requestId = newRequestId();
		await folder.writeRequest({
			protocol: CORE_UPDATE_PROTOCOL,
			requestId,
			version: fresh.latestVersion,
			requestedBy: userId,
			requestedAt: now().toISOString(),
		});
		console.info({
			atFunction: "coreUpdate.start",
			data: { userId, requestId, fromVersion: fresh.installedVersion, toVersion: fresh.latestVersion },
			message: "Core update requested from the dashboard",
		});
		return { ok: true, started: true, status: await buildStatus(release) };
	};

	return {
		getStatus: () => buildStatus(),
		start: (params) => {
			const next = startQueue.then(() => startNow(params));
			startQueue = next.then(
				() => undefined,
				() => undefined,
			);
			return next;
		},
	};
}
