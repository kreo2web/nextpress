import compression from "compression";
import type { Request, Response } from "express";

/**
 * A live stream (the page assistant's reply) is written piece by piece. Compression holds pieces
 * back until it has enough to squeeze, so the person would see nothing until the run ended.
 */
const isLiveStream = (res: Response): boolean =>
	String(res.getHeader("Content-Type") ?? "").startsWith("text/event-stream");

/**
 * Gzip or Brotli for text responses, whenever the browser asks. Always on: it costs nothing, and the
 * old per-site switch was shared by every site on the install (one site turning it off did it for all).
 */
export function responseCompression() {
	return compression({
		filter(req: Request, res: Response): boolean {
			if (isLiveStream(res)) return false;
			return compression.filter(req, res);
		},
	});
}
