import { describe, expect, it } from "vitest";
import { checkPublicAddress, createSafePublicFetch } from "../utils/safe-public-fetch";

/** Names resolve only through this table; anything else fails like a missing domain. */
const resolveDns = async (host: string): Promise<string[]> => {
	const table: Record<string, string[]> = {
		"blog.example": ["93.184.216.34"],
		"mixed.example": ["93.184.216.34", "10.0.0.7"],
		"sneaky.example": ["::ffff:127.0.0.1"],
		"metadata.example": ["169.254.169.254"],
	};
	const found = table[host];
	if (!found) throw new Error(`getaddrinfo ENOTFOUND ${host}`);
	return found;
};

const refused = async (input: string): Promise<boolean> => !(await checkPublicAddress({ input, resolveDns })).ok;

describe("addresses the server may fetch for an import", () => {
	it("allows a public site over http or https", async () => {
		expect(await checkPublicAddress({ input: "http://blog.example/wp-json", resolveDns })).toMatchObject({ ok: true, addresses: ["93.184.216.34"] });
		expect(await refused("https://blog.example")).toBe(false);
	});

	it("refuses this machine and private networks, however they are written", async () => {
		for (const input of [
			"http://localhost:5000",
			"http://api.localhost",
			"http://127.0.0.1",
			"http://[::1]:8080",
			"http://[::ffff:127.0.0.1]",
			"http://10.1.2.3",
			"http://100.64.0.1",
			"http://192.168.1.1",
			"http://169.254.169.254/latest/meta-data",
			"http://metadata.google.internal",
		]) {
			expect(await refused(input), input).toBe(true);
		}
	});

	it("refuses a name when any address it leads to is private (DNS tricks)", async () => {
		expect(await refused("http://mixed.example")).toBe(true);
		expect(await refused("http://sneaky.example")).toBe(true);
		expect(await refused("http://metadata.example")).toBe(true);
	});

	it("refuses when the name can't be looked up, instead of letting the fetch decide", async () => {
		const result = await checkPublicAddress({ input: "http://nowhere.example", resolveDns });
		expect(result).toMatchObject({ ok: false });
		expect(result.ok ? null : result.cause?.message).toMatch(/ENOTFOUND/);
	});

	it("refuses other schemes and addresses with a login", async () => {
		expect(await refused("file:///etc/passwd")).toBe(true);
		expect(await refused("ftp://blog.example")).toBe(true);
		expect(await refused("http://user:pass@blog.example")).toBe(true);
	});

	it("the fetch itself refuses a private address before connecting, with a plain message for people", async () => {
		const publicFetch = createSafePublicFetch({ resolveDns });
		await expect(publicFetch("http://127.0.0.1:1/x")).rejects.toMatchObject({ userMessage: expect.stringMatching(/private network/) });
	});
});
