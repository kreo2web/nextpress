import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { responseCompression } from "../lib/response-compression";

/** Reads a response and notes when each piece arrived, before decoding: what the browser's network layer sees. */
const readArrivals = ({ port, path }: { port: number; path: string }): Promise<{ encoding: string | undefined; arrivals: number[]; endedAt: number }> =>
	new Promise((resolve, reject) => {
		const startedAt = Date.now();
		const arrivals: number[] = [];
		const req = request({ port, path, headers: { "Accept-Encoding": "br, gzip" } }, (res) => {
			res.on("data", () => arrivals.push(Date.now() - startedAt));
			res.on("end", () => resolve({ encoding: res.headers["content-encoding"], arrivals, endedAt: Date.now() - startedAt }));
		});
		req.on("error", reject);
		req.end();
	});

describe("response compression", () => {
	let server: Server;
	let port: number;

	beforeAll(async () => {
		const app = express();
		app.use(responseCompression());
		app.get("/page", (_req, res) => res.type("html").send(`<p>${"hello ".repeat(400)}</p>`));
		// Shaped like the assistant's reply: a text/event-stream written piece by piece over time.
		app.get("/stream", (_req, res) => {
			res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
			res.write(`data: ${JSON.stringify({ type: "start" })}\n\n`);
			setTimeout(() => {
				res.write(`data: ${JSON.stringify({ type: "finish" })}\n\n`);
				res.end();
			}, 300);
		});
		server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = (server.address() as AddressInfo).port;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it("compresses pages and JSON for browsers that ask", async () => {
		const { encoding } = await readArrivals({ port, path: "/page" });
		expect(encoding).toBe("br");
	});

	it("sends a live stream as it is written, not held back until the end", async () => {
		const { encoding, arrivals, endedAt } = await readArrivals({ port, path: "/stream" });
		expect(encoding).toBeUndefined();
		expect(arrivals.length).toBeGreaterThan(0);
		// The first piece must arrive well before the stream ends 300 ms later.
		expect(arrivals[0]).toBeLessThan(endedAt - 150);
	});
});
