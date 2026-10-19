import type { DownloadedFile } from "../types/client.js";

const FILE_NAME = /filename\s*=\s*(?:"([^"]*)"|([^;\s]+))/i;

/** Last path segment only: a download's name must never carry folders. */
const baseName = (name: string): string => name.split(/[\\/]/).pop()?.trim() ?? "";

/**
 * Reads the file name a server suggests in `Content-Disposition`.
 * Returns null when the header is missing or names nothing usable, so callers pick their own fallback.
 */
export function readDispositionFileName(header: string | null): string | null {
	if (!header) return null;
	const match = FILE_NAME.exec(header);
	const name = baseName(match?.[1] ?? match?.[2] ?? "");
	return name === "" ? null : name;
}

/**
 * Reads a response body as bytes together with its name and content type.
 * Plain `Uint8Array` so it works the same in Node 20+ and browsers, with no Buffer or stream types.
 */
export async function readDownloadedFile(response: Response): Promise<DownloadedFile> {
	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		fileName: readDispositionFileName(response.headers.get("content-disposition")),
		contentType: response.headers.get("content-type") ?? "application/octet-stream",
	};
}
