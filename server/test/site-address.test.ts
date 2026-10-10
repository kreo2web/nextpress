import { describe, expect, it } from "vitest";
import {
	findAddressOwner,
	parseSiteAddress,
	pickPreferredSite,
	readSiteAddress,
	siteAnswersHost,
} from "../utils/site-address";
import { getCaddyTlsHostnames, normalizeSiteHostname } from "../utils/validate-domain";

const site = ({
	id,
	siteUrl = null,
	settings = {},
	isDefault = false,
	createdAt = new Date("2026-01-01T00:00:00Z"),
	name = null,
}: {
	id: string;
	siteUrl?: string | null;
	settings?: Record<string, object>;
	isDefault?: boolean;
	createdAt?: Date;
	name?: string | null;
}) => ({ id, siteUrl, settings, isDefault, createdAt, name });

describe("parseSiteAddress", () => {
	it("cleans a domain to lower case https with no path or trailing slash", () => {
		expect(parseSiteAddress("  HTTPS://Shop.Example.com/home/?x=1#top ")).toEqual({
			ok: true,
			url: "https://shop.example.com",
			host: "shop.example.com",
			isLocal: false,
		});
	});

	it("adds https to a bare domain and drops a port on public domains", () => {
		expect(parseSiteAddress("example.com:8443")).toMatchObject({ ok: true, url: "https://example.com" });
	});

	it("uses http and keeps the port for localhost, *.localhost and IP addresses", () => {
		expect(parseSiteAddress("localhost:5000")).toMatchObject({ ok: true, url: "http://localhost:5000", isLocal: true });
		expect(parseSiteAddress("https://localhost:5000")).toMatchObject({ url: "http://localhost:5000" });
		expect(parseSiteAddress("site2.localhost:5000")).toMatchObject({ url: "http://site2.localhost:5000", isLocal: true });
		expect(parseSiteAddress("203.0.113.10")).toMatchObject({ url: "http://203.0.113.10", isLocal: true });
	});

	it("turns international domains into their DNS form", () => {
		expect(parseSiteAddress("münchen.de")).toMatchObject({ ok: true, url: "https://xn--mnchen-3ya.de" });
	});

	it("refuses things that are not web addresses, in plain words", () => {
		for (const input of ["", "   ", "exa mple.com", "example", "ftp://example.com", "bad_name.com"]) {
			const parsed = parseSiteAddress(input);
			expect(parsed.ok).toBe(false);
			if (!parsed.ok) expect(parsed.message).not.toMatch(/regex|hostname|undefined/i);
		}
	});
});

describe("normalizeSiteHostname", () => {
	it("compares equal for capitals, slashes, paths, ports and a trailing dot", () => {
		for (const input of ["Site2.com", "https://site2.com/", "site2.com/home", "SITE2.COM:443", "site2.com."]) {
			expect(normalizeSiteHostname(input)).toBe("site2.com");
		}
	});
});

describe("getCaddyTlsHostnames", () => {
	it("adds a www twin only for top-level domains", () => {
		expect(getCaddyTlsHostnames("https://example.com")).toEqual(["example.com", "www.example.com"]);
		expect(getCaddyTlsHostnames("https://example.co.ug")).toEqual(["example.co.ug", "www.example.co.ug"]);
		expect(getCaddyTlsHostnames("https://example.co.uk")).toEqual(["example.co.uk", "www.example.co.uk"]);
		expect(getCaddyTlsHostnames("https://www.example.com")).toEqual(["www.example.com", "example.com"]);
	});

	it("never asks for www on a subdomain, IP or localhost", () => {
		expect(getCaddyTlsHostnames("https://shop.example.com")).toEqual(["shop.example.com"]);
		expect(getCaddyTlsHostnames("https://blog.example.io")).toEqual(["blog.example.io"]);
		expect(getCaddyTlsHostnames("http://203.0.113.10")).toEqual(["203.0.113.10"]);
		expect(getCaddyTlsHostnames("http://site2.localhost:5000")).toEqual(["site2.localhost"]);
	});
});

describe("readSiteAddress", () => {
	it("prefers the site record and falls back to an address kept only in Settings", () => {
		expect(readSiteAddress(site({ id: "a", siteUrl: "https://a.com", settings: { general: { siteUrl: "https://old.com" } } }))).toBe(
			"https://a.com",
		);
		expect(readSiteAddress(site({ id: "b", settings: { general: { siteUrl: "https://b.com" } } }))).toBe("https://b.com");
		expect(readSiteAddress(site({ id: "c" }))).toBe("");
	});
});

describe("siteAnswersHost", () => {
	it("matches the www twin and old addresses typed with capitals or a slash", () => {
		const shop = site({ id: "s", siteUrl: "https://Site2.com/" });
		expect(siteAnswersHost({ site: shop, host: "site2.com" })).toBe(true);
		expect(siteAnswersHost({ site: shop, host: "www.site2.com" })).toBe(true);
		expect(siteAnswersHost({ site: shop, host: "other.com" })).toBe(false);
	});
});

describe("pickPreferredSite", () => {
	it("prefers the default site, then the oldest, whatever order the rows come in", () => {
		const newer = site({ id: "n", createdAt: new Date("2026-05-01T00:00:00Z") });
		const older = site({ id: "o", createdAt: new Date("2026-02-01T00:00:00Z") });
		const main = site({ id: "d", isDefault: true, createdAt: new Date("2026-09-01T00:00:00Z") });
		expect(pickPreferredSite([newer, older])?.id).toBe("o");
		expect(pickPreferredSite([newer, main, older])?.id).toBe("d");
		expect(pickPreferredSite([])).toBeUndefined();
	});
});

describe("findAddressOwner", () => {
	const sites = [
		site({ id: "a", siteUrl: "https://example.com", name: "Main" }),
		site({ id: "b", siteUrl: "https://shop.example.com", name: "Shop" }),
	];

	it("finds another site already answering on the address or its www twin", () => {
		expect(findAddressOwner({ sites, address: "https://www.example.com" })?.id).toBe("a");
		expect(findAddressOwner({ sites, address: "https://SHOP.example.com/" })?.id).toBe("b");
	});

	it("ignores the site being edited and unrelated addresses", () => {
		expect(findAddressOwner({ sites, address: "https://example.com", exceptSiteId: "a" })).toBeUndefined();
		expect(findAddressOwner({ sites, address: "https://blog.example.com" })).toBeUndefined();
	});
});
