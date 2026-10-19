type StatusError = Error & { statusCode: number };

/** An error that carries the HTTP status a route should answer with (read back by `readErrorStatus`). */
export const statusError = ({ message, statusCode }: { message: string; statusCode: number }): StatusError =>
	Object.assign(new Error(message), { statusCode });

/** The HTTP status a failed lookup or refused access carries, or `fallback` for any other error. */
export const readErrorStatus = (error: Error | null | undefined, fallback = 500): number => {
	const status = (error as Partial<StatusError> | null | undefined)?.statusCode;
	return typeof status === "number" ? status : fallback;
};
