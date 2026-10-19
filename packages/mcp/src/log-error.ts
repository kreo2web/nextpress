import { isNextpressError } from "@nextpress-org/sdk";

type LogValue = string | number | boolean | null | undefined;

/** What the logs keep of a failure, so a server refusal and a network error read differently. */
export type ErrorDetail = {
	name: string;
	message: string;
	status?: number;
	code?: string;
	stack?: string;
};

/** Pulls the cause out of an error, including the status and code of a failed NextPress request. */
export function describeError(error: Error): ErrorDetail {
	const base = { name: error.name, message: error.message, stack: error.stack };
	return isNextpressError(error) ? { ...base, status: error.status, code: error.code } : base;
}

/**
 * Logs one failure as a JSON line on stderr. stdout carries the MCP protocol, so a log line
 * there would corrupt the stream; stderr is what MCP clients show as the server's log.
 */
export function logError({
	atFunction,
	message,
	data,
	error,
}: {
	atFunction: string;
	message: string;
	/** The ids that identify what failed (page id, tool name…), so the log needs no repro. */
	data?: Record<string, LogValue>;
	error?: Error;
}): void {
	console.error(
		JSON.stringify({
			level: "error",
			source: "nextpress-mcp",
			atFunction,
			message,
			data,
			error: error ? describeError(error) : undefined,
		}),
	);
}
