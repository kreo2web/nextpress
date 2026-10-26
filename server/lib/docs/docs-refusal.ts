/**
 * A docs request the server says no to, with the words the person sees. `line` points at the
 * MDX line to fix when the refusal is about a page's text.
 */
export type DocsRefusal = Error & { docsRefusal: true; statusCode: number; publicMessage: string; line: number | null };

export const refuseDocs = ({
	statusCode,
	message,
	line = null,
	cause,
}: {
	statusCode: number;
	message: string;
	line?: number | null;
	/** What the log says when it differs from what the person sees. */
	cause?: string;
}): DocsRefusal => Object.assign(new Error(cause ?? message), { docsRefusal: true as const, statusCode, publicMessage: message, line });

export const isDocsRefusal = (error: Error): error is DocsRefusal => (error as Partial<DocsRefusal>).docsRefusal === true;
