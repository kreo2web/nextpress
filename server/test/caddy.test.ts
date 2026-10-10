import { describe, expect, it } from "vitest";
import { applyCaddyfile, buildMultiSiteCaddyfile, syncCaddyFromSites, type CaddyIo } from "../utils/caddy";

const recordingIo = (load: Awaited<ReturnType<CaddyIo["load"]>>, write: Awaited<ReturnType<CaddyIo["write"]>> = { outcome: "written" }) => {
	const calls: string[] = [];
	const io: CaddyIo = {
		load: async () => {
			calls.push("load");
			return load;
		},
		write: async () => {
			calls.push("write");
			return write;
		},
	};
	return { io, calls };
};

const siteRow = ({ id, siteUrl, isDefault = false, adminEmail }: { id: string; siteUrl: string | null; isDefault?: boolean; adminEmail?: string }) => ({
	id,
	name: id,
	description: null,
	logoUrl: null,
	faviconUrl: null,
	siteUrl,
	ownerId: "u",
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	settings: adminEmail ? { general: { adminEmail } } : {},
	activeThemeId: null,
	isDefault,
	other: {},
});

describe("buildMultiSiteCaddyfile", () => {
	it("keeps an IP-based site on plain :80 when a domain site is added", () => {
		const file = buildMultiSiteCaddyfile({ addresses: ["http://203.0.113.10", "https://shop.example.com"] });
		expect(file).toContain("shop.example.com {\n  reverse_proxy app:5000\n}");
		expect(file).toContain(":80 {\n  reverse_proxy app:5000\n}");
		expect(file).not.toMatch(/203\.0\.113\.10[^\n]*\{/);
	});

	it("lists every domain (and top-level www twins) in one HTTPS block, with no :80 when there is no IP", () => {
		const file = buildMultiSiteCaddyfile({ addresses: ["https://example.com", "https://Shop.Example.com/"], acmeEmail: "me@example.com" });
		expect(file).toContain("example.com, www.example.com, shop.example.com {");
		expect(file).not.toContain(":80");
		expect(file).toContain("  email me@example.com\n");
	});

	it("falls back to :80 for localhost-only installs", () => {
		expect(buildMultiSiteCaddyfile({ addresses: ["http://localhost:5000", "http://site2.localhost:5000"] })).toContain(":80 {");
	});

	it("leaves out a stored address that is not a clean domain, so it can't break the file", () => {
		const file = buildMultiSiteCaddyfile({ addresses: ["https://good.com", "bad host {}"] });
		expect(file).toContain("good.com, www.good.com {");
		expect(file).not.toContain("bad");
	});
});

describe("applyCaddyfile", () => {
	it("never writes a setup Caddy refused", async () => {
		const { io, calls } = recordingIo({ outcome: "refused", reason: "HTTP 400: bad address" });
		expect(await applyCaddyfile({ caddyfile: "x", io })).toEqual({ status: "refused", reason: "HTTP 400: bad address" });
		expect(calls).toEqual(["load"]);
	});

	it("writes the file after Caddy accepts it", async () => {
		const { io, calls } = recordingIo({ outcome: "accepted" });
		expect(await applyCaddyfile({ caddyfile: "x", io })).toEqual({ status: "applied" });
		expect(calls).toEqual(["load", "write"]);
	});

	it("still writes the file when Caddy can't be reached, so a restart picks it up", async () => {
		const { io } = recordingIo({ outcome: "unreachable", reason: "ENOTFOUND caddy" });
		expect(await applyCaddyfile({ caddyfile: "x", io })).toEqual({ status: "saved-for-restart", reason: "ENOTFOUND caddy" });
	});

	it("reports a skip when there is no web server here (local development)", async () => {
		const { io } = recordingIo({ outcome: "unreachable", reason: "ENOTFOUND caddy" }, { outcome: "unwritable", reason: "EACCES" });
		expect((await applyCaddyfile({ caddyfile: "x", io })).status).toBe("skipped");
	});
});

describe("syncCaddyFromSites", () => {
	it("builds from every site's address, including one kept only in Settings, with the default site's email", async () => {
		const loaded: string[] = [];
		const io: CaddyIo = {
			load: async (caddyfile) => {
				loaded.push(caddyfile);
				return { outcome: "accepted" };
			},
			write: async () => ({ outcome: "written" }),
		};
		const main = siteRow({ id: "main", siteUrl: "https://example.com", isDefault: true, adminEmail: "owner@example.com" });
		const shop = { ...siteRow({ id: "shop", siteUrl: null }), settings: { general: { siteUrl: "https://shop.example.com" } } };
		const update = await syncCaddyFromSites({ models: { sites: { findMany: async () => [main, shop] } }, io });
		expect(update).toEqual({ status: "applied" });
		expect(loaded[0]).toContain("example.com, www.example.com, shop.example.com {");
		expect(loaded[0]).toContain("email owner@example.com");
	});

	it("leaves the web server alone when no site has an address", async () => {
		const { io, calls } = recordingIo({ outcome: "accepted" });
		const update = await syncCaddyFromSites({ models: { sites: { findMany: async () => [siteRow({ id: "a", siteUrl: null })] } }, io });
		expect(update.status).toBe("skipped");
		expect(calls).toEqual([]);
	});

	it("runs one sync at a time, in the order they were asked for", async () => {
		const order: string[] = [];
		const slowIo: CaddyIo = {
			load: async (caddyfile) => {
				order.push(`start:${caddyfile.includes("first.com") ? "first" : "second"}`);
				await new Promise((resolve) => setTimeout(resolve, 20));
				order.push(`end:${caddyfile.includes("first.com") ? "first" : "second"}`);
				return { outcome: "accepted" };
			},
			write: async () => ({ outcome: "written" }),
		};
		const first = syncCaddyFromSites({ models: { sites: { findMany: async () => [siteRow({ id: "a", siteUrl: "https://first.com" })] } }, io: slowIo });
		const second = syncCaddyFromSites({ models: { sites: { findMany: async () => [siteRow({ id: "b", siteUrl: "https://second.com" })] } }, io: slowIo });
		await Promise.all([first, second]);
		expect(order).toEqual(["start:first", "end:first", "start:second", "end:second"]);
	});
});
