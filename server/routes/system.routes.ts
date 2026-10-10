import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type Request, type Response } from "express";
import type { Deps } from "./shared/deps";
import { asyncHandler } from "./shared/async-handler";
import { evaluateUpgrade } from "@shared/release/evaluate-upgrade";
import { isUpdateAvailable } from "@shared/release/fetch-latest-version";
import { RELEASE_MANIFEST } from "@shared/release/release-manifest";
import { parseNextpressConfig } from "@shared/release/nextpress-config";
import {
	getAutoUpgradeEnabled,
	getNextpressInstallDir,
	getNodeEnv,
	readInstalledAppVersion,
} from "../config";
import { requireSessionAuth } from "../auth";
import {
	canManageCoreUpdates,
	createCoreUpdateService,
	createLatestReleaseLookup,
	createUpdateFolder,
	defaultUpdateFolderDir,
} from "../lib/core-update";
import { verifySessionPassword } from "../lib/core-update/verify-session-password";
import { createCoreUpdateRoutes } from "./core-update.routes";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const readJsonFile = (filePath: string): unknown | null => {
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
	} catch {
		return null;
	}
};

const readTargetConfig = () => {
	const parsed = parseNextpressConfig(readJsonFile(path.join(repoRoot, "nextpress.config.json")));
	if (!parsed.ok) {
		throw new Error(parsed.reason);
	}
	return parsed.config;
};

const readInstallConfig = (installDir: string | null) => {
	if (!installDir) return null;
	const parsed = parseNextpressConfig(
		readJsonFile(path.join(installDir, "nextpress.config.json")),
	);
	return parsed.ok ? parsed.config : null;
};

const resolveNextpressCliPath = (installDir: string | null): string | null => {
	const candidates = [
		process.env.NEXTPRESS_CLI_PATH?.trim(),
		installDir ? path.join(installDir, "nextpress") : null,
		path.join(repoRoot, "scripts", "nextpress"),
		"/usr/local/bin/nextpress",
	].filter((value): value is string => !!value);

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
};

/**
 * Release info, the legacy upgrade check, and one-click updates for the admin UI.
 *
 * GET  /api/system/release          What's New for everyone signed in
 * POST /api/system/upgrade/check    legacy assessment (SDK `checkUpgrade`), main-site admins
 * POST /api/system/upgrade/run      legacy (SDK `runUpgrade`): no longer starts anything; points to the dashboard
 * GET  /api/system/update/status    one-click update status (core-update.routes.ts)
 * POST /api/system/update/start     one-click update start (core-update.routes.ts)
 */
export function createSystemRoutes(deps: Deps): Router {
	const router = Router();
	const { requireAuth, authService, models } = deps;
	const latest = createLatestReleaseLookup({ fallbackVersion: RELEASE_MANIFEST.version });

	const requireAdmin = async (req: Request, res: Response): Promise<string | null> => {
		const userId = authService.getCurrentUserId(req);
		if (!userId) {
			res.status(401).json({ message: "Unauthorized" });
			return null;
		}
		if (!(await canManageCoreUpdates({ models, userId }))) {
			res.status(403).json({ message: "Only the main site's admins can update NextPress." });
			return null;
		}
		return userId;
	};

	const buildLegacyAssessment = async () => {
		const installedVersion = readInstalledAppVersion();
		const { latestVersion } = await latest.get();
		const installDir = getNextpressInstallDir();
		return evaluateUpgrade({
			nodeEnv: getNodeEnv(),
			installDir,
			installConfig: readInstallConfig(installDir),
			targetConfig: readTargetConfig(),
			installedVersion,
			latestVersion,
			autoUpgradeEnabled: getAutoUpgradeEnabled(),
			dockerSocketAccessible: fs.existsSync("/var/run/docker.sock"),
			nextpressCliPath: resolveNextpressCliPath(installDir),
		});
	};

	router.get(
		"/release",
		requireAuth,
		asyncHandler(async (_req, res) => {
			const installedVersion = readInstalledAppVersion();
			const release = await latest.get();

			res.json({
				installedVersion,
				latestVersion: release.latestVersion,
				updateAvailable: isUpdateAvailable({
					installedVersion,
					latestVersion: release.latestVersion,
				}),
				updateCheck: {
					source: release.source,
					ok: release.checkOk,
					note: release.checkNote,
					checkedAt: release.checkedAt,
				},
				releaseDate: RELEASE_MANIFEST.releaseDate,
				highlights: RELEASE_MANIFEST.highlights,
				supportedUpgradeFrom: RELEASE_MANIFEST.supportedUpgradeFrom,
			});
		}),
	);

	router.post(
		"/upgrade/check",
		requireAuth,
		asyncHandler(async (req, res) => {
			if (!(await requireAdmin(req, res))) return;
			res.json(await buildLegacyAssessment());
		}),
	);

	// The app used to run the CLI itself from here, which needs the Docker socket inside the container and stops
	// the container running it. Updates now go through the host update helper: started from the dashboard with a
	// password, or with `nextpress upgrade` on the server.
	router.post(
		"/upgrade/run",
		requireAuth,
		asyncHandler(async (req, res) => {
			if (!(await requireAdmin(req, res))) return;
			res.status(409).json({
				message:
					"Updates start from the dashboard now: open the update notice and choose Update now, or run nextpress upgrade on the server.",
				assessment: await buildLegacyAssessment(),
			});
		}),
	);

	router.use(
		"/update",
		createCoreUpdateRoutes({
			models,
			requireSession: requireSessionAuth,
			getUserId: (req) => authService.getCurrentUserId(req),
			verifyPassword: verifySessionPassword,
			service: createCoreUpdateService({
				folder: createUpdateFolder({ dir: defaultUpdateFolderDir() }),
				latest,
				nodeEnv: getNodeEnv(),
				readInstalledVersion: readInstalledAppVersion,
			}),
		}),
	);

	return router;
}
