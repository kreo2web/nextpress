import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
	CoreUpdateFolderSnapshot,
	CoreUpdateHelperFile,
	CoreUpdatePendingRequest,
	CoreUpdateRequestFile,
	CoreUpdateRunnerStatusFile,
} from "@shared/core-update";
import { safeTryAsync } from "../../utils";

/** File names shared with `nextpress update-runner` (scripts/nextpress). */
export const UPDATE_FILES = {
	request: "request.json",
	status: "status.json",
	helper: "runner.json",
} as const;

/** These files are a few hundred bytes; anything bigger is not ours and is ignored. */
const MAX_FILE_BYTES = 64 * 1024;

/**
 * Where compose mounts the host's `<install>/update` folder in the app container (`/app/update`, the image's
 * working folder). In development nothing is mounted there, which the status reports as "development".
 */
export const defaultUpdateFolderDir = (): string => path.join(process.cwd(), "update");

const requestSchema = z.object({
	protocol: z.number(),
	requestId: z.string().min(1).max(64),
	version: z.string().min(1).max(32),
	requestedBy: z.string().max(64),
	requestedAt: z.string().max(64),
});

const statusSchema = z.object({
	protocol: z.number(),
	state: z.enum(["running", "done", "failed"]),
	code: z.string().max(64),
	step: z.string().max(32),
	requestId: z.string().max(64),
	version: z.string().max(32),
	fromTag: z.string().max(128),
	startedAt: z.string().max(64),
	finishedAt: z.string().max(64),
	logPath: z.string().max(1024),
	siteRestored: z.boolean(),
});

const helperSchema = z.object({
	protocol: z.number(),
	enabled: z.boolean(),
	helper: z.string().max(64),
	installDir: z.string().max(1024),
	cliVersion: z.string().max(128),
	updatedAt: z.string().max(64),
});

type ParsedFile<T> = { value: T; modifiedAt: Date } | null;

const isMissing = (error: Error): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

const logUnlessMissing = ({ error, filePath, message }: { error: Error; filePath: string; message: string }): null => {
	if (!isMissing(error)) {
		console.error({ atFunction: "updateFolder.read", data: { filePath, error }, message });
	}
	return null;
};

export type UpdateFolder = {
	/** Reads the three shared files; a missing, foreign or broken file reads as absent. */
	read: () => Promise<CoreUpdateFolderSnapshot>;
	/** Leaves a request for the host runner: written to a temp name, then renamed so it appears whole. */
	writeRequest: (request: CoreUpdateRequestFile) => Promise<void>;
};

/** The shared update folder, reached only through these two operations. */
export function createUpdateFolder({ dir }: { dir: string }): UpdateFolder {
	const readJson = async <T>({ name, schema }: { name: string; schema: z.ZodType<T> }): Promise<ParsedFile<T>> => {
		const filePath = path.join(dir, name);
		const stats = await fs
			.lstat(filePath)
			.catch((error: Error) => logUnlessMissing({ error, filePath, message: "Could not look at update file" }));
		// Only plain files: links, folders and oversized files are never ours.
		if (!stats || !stats.isFile() || stats.size > MAX_FILE_BYTES) return null;

		const text = await fs
			.readFile(filePath, "utf8")
			.catch((error: Error) => logUnlessMissing({ error, filePath, message: "Could not read update file" }));
		if (text === null) return null;

		const { err, result: raw } = await safeTryAsync(async () => JSON.parse(text) as object);
		if (err) {
			console.error({ atFunction: "updateFolder.read", data: { filePath, error: err }, message: "Update file is not valid JSON" });
			return null;
		}
		const parsed = schema.safeParse(raw);
		if (!parsed.success) {
			console.error({
				atFunction: "updateFolder.read",
				data: { filePath, issues: parsed.error.issues },
				message: "Update file has an unexpected shape",
			});
			return null;
		}
		return { value: parsed.data, modifiedAt: stats.mtime };
	};

	return {
		async read() {
			const folderStats = await fs
				.stat(dir)
				.catch((error: Error) => logUnlessMissing({ error, filePath: dir, message: "Could not look at update folder" }));
			if (!folderStats?.isDirectory()) {
				return { folderExists: false, helper: null, request: null, status: null };
			}

			const [request, status, helper] = await Promise.all([
				readJson<CoreUpdateRequestFile>({ name: UPDATE_FILES.request, schema: requestSchema }),
				readJson<CoreUpdateRunnerStatusFile>({ name: UPDATE_FILES.status, schema: statusSchema }),
				readJson<CoreUpdateHelperFile>({ name: UPDATE_FILES.helper, schema: helperSchema }),
			]);

			const pending: CoreUpdatePendingRequest | null = request
				? { ...request.value, writtenAt: request.modifiedAt.toISOString() }
				: null;

			return { folderExists: true, helper: helper?.value ?? null, request: pending, status: status?.value ?? null };
		},

		async writeRequest(request) {
			const tempPath = path.join(dir, `.request-${randomUUID()}.tmp`);
			const finalPath = path.join(dir, UPDATE_FILES.request);
			// Pretty-printed, one key per line: the bash runner reads each field on its own and checks it.
			await fs.writeFile(tempPath, `${JSON.stringify(request, null, 2)}\n`, { flag: "wx", mode: 0o644 });
			const { err } = await safeTryAsync(() => fs.rename(tempPath, finalPath));
			if (!err) return;

			await fs.rm(tempPath, { force: true }).catch((cleanupError: Error) => {
				console.error({
					atFunction: "updateFolder.writeRequest",
					data: { tempPath, error: cleanupError },
					message: "Could not remove a half-written update request",
				});
			});
			throw err;
		},
	};
}
