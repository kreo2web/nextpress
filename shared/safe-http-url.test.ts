import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, normalizeWebsiteUrl, normalizeXProfileUrl } from "./safe-http-url";

describe("isSafeHttpUrl", () => {
	it("keeps http(s) and refuses other schemes", () => {
		expect(isSafeHttpUrl("https://example.com")).toBe(true);
		expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeHttpUrl("/relative")).toBe(false);
	});
});

describe("normalizeWebsiteUrl", () => {
	it("adds https when the value looks like a domain", () => {
		expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com");
		expect(normalizeWebsiteUrl("https://example.com/about")).toBe("https://example.com/about");
		expect(normalizeWebsiteUrl("not a url")).toBe("");
	});
});

describe("normalizeXProfileUrl", () => {
	it("accepts a handle, a username, or a full URL", () => {
		expect(normalizeXProfileUrl("@Ada_Lovelace")).toBe("https://x.com/Ada_Lovelace");
		expect(normalizeXProfileUrl("Ada")).toBe("https://x.com/Ada");
		expect(normalizeXProfileUrl("https://x.com/Ada")).toBe("https://x.com/Ada");
	});
});
