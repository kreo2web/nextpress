import type { BlockConfig } from "./domain.js";

/** Options passed to {@link createNextpress}. */
export type NextpressOptions = {
	/** Base URL of your NextPress instance, e.g. `https://cms.example.com` */
	baseUrl: string;
	/** API key generated from the NextPress dashboard */
	apiKey: string;
	/** Site UUID the API key is bound to. Must match the site chosen when the key was created. */
	siteId: string;
	/** Custom fetch implementation (defaults to global `fetch`) */
	fetch?: typeof fetch;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
};

/** Internal HTTP client configuration derived from {@link NextpressOptions}. */
export type HttpClientConfig = {
	baseUrl: string;
	apiKey: string;
	siteId?: string;
	fetch: typeof fetch;
	timeout: number;
};

/** Common pagination query params for list endpoints. */
export type PaginationParams = {
	page?: number;
	per_page?: number;
};

/** HTTP method verbs used by the SDK. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Options for a single HTTP request. */
export type RequestOptions = {
	method?: HttpMethod;
	query?: Record<string, string | number | boolean | undefined | null>;
	body?: unknown;
	headers?: Record<string, string>;
	/** Skip JSON parsing and return raw Response (for file uploads). */
	raw?: boolean;
	/** When false, omit Bearer auth (for public share-token preview fetches). Default true. */
	auth?: boolean;
	/**
	 * `"file"` returns the body as bytes with its file name and content type (for downloads).
	 * Errors still become `NextpressError`. Default: JSON or text, by the response's content type.
	 */
	responseType?: "auto" | "file";
};

/** A downloaded file: the bytes plus what the server said about it. */
export type DownloadedFile = {
	bytes: Uint8Array;
	/** Name from the server's `Content-Disposition`, or null when it sent none. */
	fileName: string | null;
	contentType: string;
};

/** Shape returned by block builder helpers. */
export type BlockBuilderResult = BlockConfig;
