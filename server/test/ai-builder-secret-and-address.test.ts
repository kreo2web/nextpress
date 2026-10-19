import { describe, expect, it } from "vitest";
import { checkServiceAddress, classifyIp, openSecret, sealSecret, type ResolveDns } from "../lib/ai-builder";

const RAW_KEY = "sk-live-9f8e7d6c5b4a39281706f5e4d3c2b1a0";

describe("secret box", () => {
	it("opens what it sealed, and the stored text does not contain the secret", () => {
		const sealed = sealSecret({ secret: RAW_KEY, passphrase: "server-secret-one" });
		expect(sealed.v).toBe(1);
		expect(Buffer.from(sealed.iv, "base64")).toHaveLength(12);
		expect(Buffer.from(sealed.tag, "base64")).toHaveLength(16);
		expect(JSON.stringify(sealed)).not.toContain(RAW_KEY);
		expect(Buffer.from(sealed.data, "base64").toString("utf8")).not.toContain(RAW_KEY);

		const opened = openSecret({ sealed, passphrase: "server-secret-one" });
		expect(opened).toEqual({ ok: true, secret: RAW_KEY });
	});

	it("uses a fresh random start value every time", () => {
		const first = sealSecret({ secret: RAW_KEY, passphrase: "server-secret-one" });
		const second = sealSecret({ secret: RAW_KEY, passphrase: "server-secret-one" });
		expect(first.iv).not.toBe(second.iv);
		expect(first.data).not.toBe(second.data);
	});

	it("fails with a cause, without throwing, when the passphrase changed", () => {
		const sealed = sealSecret({ secret: RAW_KEY, passphrase: "server-secret-one" });
		const opened = openSecret({ sealed, passphrase: "server-secret-two" });
		expect(opened.ok).toBe(false);
		expect(opened.ok === false && opened.cause).toBeInstanceOf(Error);
	});

	it("fails when the check value, the data or the start value was changed", () => {
		const sealed = sealSecret({ secret: RAW_KEY, passphrase: "server-secret-one" });
		const flipFirstByte = (value: string): string => {
			const bytes = Buffer.from(value, "base64");
			bytes[0] = (bytes[0] ?? 0) ^ 0xff;
			return bytes.toString("base64");
		};

		expect(openSecret({ sealed: { ...sealed, tag: flipFirstByte(sealed.tag) }, passphrase: "server-secret-one" }).ok).toBe(false);
		expect(openSecret({ sealed: { ...sealed, data: flipFirstByte(sealed.data) }, passphrase: "server-secret-one" }).ok).toBe(false);
		expect(openSecret({ sealed: { ...sealed, iv: flipFirstByte(sealed.iv) }, passphrase: "server-secret-one" }).ok).toBe(false);
		expect(openSecret({ sealed: { ...sealed, iv: "AAAA" }, passphrase: "server-secret-one" }).ok).toBe(false);
		expect(openSecret({ sealed: { ...sealed, tag: "" }, passphrase: "server-secret-one" }).ok).toBe(false);
	});
});

describe("classifyIp", () => {
	it.each([
		["8.8.8.8", "public"],
		["93.184.216.34", "public"],
		["172.15.0.1", "public"],
		["172.32.0.1", "public"],
		["100.63.255.255", "public"],
		["100.128.0.1", "public"],
		["2606:4700:4700::1111", "public"],
		["127.0.0.1", "local"],
		["127.255.255.254", "local"],
		["10.1.2.3", "local"],
		["172.16.0.1", "local"],
		["172.31.255.255", "local"],
		["192.168.0.10", "local"],
		["100.64.0.1", "local"],
		["100.127.255.255", "local"],
		["0.0.0.0", "local"],
		["203.0.113.9", "local"],
		["::1", "local"],
		["::", "local"],
		["fc00::1", "local"],
		["fd12:3456:789a::1", "local"],
		["169.254.169.254", "blocked"],
		["169.254.0.1", "blocked"],
		["168.63.129.16", "blocked"],
		["100.100.100.200", "blocked"],
		["224.0.0.1", "blocked"],
		["255.255.255.255", "blocked"],
		["fe80::1", "blocked"],
		["fe80::1%eth0", "blocked"],
		["febf::1", "blocked"],
		["ff02::1", "blocked"],
		["fd00:ec2::254", "blocked"],
		["fd20:ce::254", "blocked"],
	] as const)("%s is %s", (address, expected) => {
		expect(classifyIp(address)).toBe(expected);
	});

	it("reads the IPv4 address hidden inside an IPv6 one", () => {
		expect(classifyIp("::ffff:127.0.0.1")).toBe("local");
		expect(classifyIp("::ffff:7f00:1")).toBe("local");
		expect(classifyIp("::ffff:10.0.0.1")).toBe("local");
		expect(classifyIp("::ffff:169.254.169.254")).toBe("blocked");
		expect(classifyIp("::ffff:a9fe:a9fe")).toBe("blocked");
		expect(classifyIp("::ffff:8.8.8.8")).toBe("public");
		expect(classifyIp("::127.0.0.1")).toBe("local");
		expect(classifyIp("64:ff9b::7f00:1")).toBe("local");
		expect(classifyIp("64:ff9b::808:808")).toBe("public");
		expect(classifyIp("2002:7f00:1::")).toBe("local");
		expect(classifyIp("2002:808:808::")).toBe("public");
	});

	it("blocks anything it cannot read as an address", () => {
		expect(classifyIp("not-an-address")).toBe("blocked");
		expect(classifyIp("")).toBe("blocked");
		expect(classifyIp("999.1.1.1")).toBe("blocked");
	});
});

const createFakeDns = (table: Record<string, string[] | Error>) => {
	const asked: string[] = [];
	const resolveDns: ResolveDns = async (hostname) => {
		asked.push(hostname);
		const hit = table[hostname];
		if (!hit) throw new Error(`getaddrinfo ENOTFOUND ${hostname}`);
		if (hit instanceof Error) throw hit;
		return hit;
	};
	return { resolveDns, asked };
};

describe("checkServiceAddress", () => {
	const dns = createFakeDns({
		"api.example.com": ["93.184.216.34"],
		"both.example.com": ["93.184.216.34", "2606:4700:4700::1111"],
		"lan.example.com": ["192.168.1.40"],
		"v6-lan.example.com": ["fd00::5"],
		"split.example.com": ["93.184.216.34", "10.0.0.7"],
		"v6-split.example.com": ["93.184.216.34", "fd00::7"],
		"meta.example.com": ["169.254.169.254"],
		"meta6.example.com": ["93.184.216.34", "fe80::1"],
		"empty.example.com": [],
		"slow.example.com": new Error("queryA ETIMEOUT slow.example.com"),
		"ollama.internal": ["172.17.0.1"],
	});
	const check = (input: string, allowPrivate = false) =>
		checkServiceAddress({ input, allowPrivate, resolveDns: dns.resolveDns });

	it("accepts a public https address and stores it tidy", async () => {
		expect(await check("  https://API.example.com/v1/  ")).toMatchObject({
			ok: true,
			baseUrl: "https://api.example.com/v1",
			reach: "public",
			addresses: ["93.184.216.34"],
		});
		expect(await check("https://both.example.com:8443/openai")).toMatchObject({
			ok: true,
			baseUrl: "https://both.example.com:8443/openai",
		});
		expect(await check("https://api.example.com")).toMatchObject({ ok: true, baseUrl: "https://api.example.com" });
	});

	it("refuses plain http to a public host, for everyone", async () => {
		for (const allowPrivate of [false, true]) {
			const result = await check("http://api.example.com/v1", allowPrivate);
			expect(result).toMatchObject({ ok: false, code: "needs_https" });
			expect(result.ok === false && result.message).toContain("https://");
		}
	});

	it.each([
		"http://localhost:11434/v1",
		"http://LOCALHOST./v1",
		"http://my-box.localhost:8080/v1",
		"http://127.0.0.1:1234/v1",
		"http://127.1/v1",
		"http://2130706433/v1",
		"http://0x7f.0.0.1/v1",
		"http://0.0.0.0:11434/v1",
		"http://10.0.0.5:8000/v1",
		"http://172.20.0.2/v1",
		"http://192.168.1.20/v1",
		"http://100.64.1.2/v1",
		"http://[::1]:11434/v1",
		"http://[fd12:3456::1]/v1",
		"http://[::ffff:127.0.0.1]/v1",
		"http://[::ffff:7f00:1]/v1",
		"https://lan.example.com/v1",
		"http://lan.example.com/v1",
		"https://v6-lan.example.com/v1",
		"https://split.example.com/v1",
		"https://v6-split.example.com/v1",
		"http://ollama.internal:11434/v1",
	])("treats %s as private: refused for ordinary admins, accepted for main-site admins", async (input) => {
		const refused = await check(input, false);
		expect(refused).toMatchObject({ ok: false, code: "not_public" });
		expect(refused.ok === false && refused.message).toBe(
			"That address isn't reachable from the internet. Use a public https address, or ask the main site's admin to add a local one.",
		);
		expect(await check(input, true)).toMatchObject({ ok: true, reach: "local" });
	});

	it.each([
		"http://169.254.169.254/latest/meta-data",
		"https://169.254.169.254",
		"http://[::ffff:169.254.169.254]/",
		"http://[fe80::1]/",
		"http://[fd00:ec2::254]/",
		"http://metadata.google.internal/computeMetadata/v1",
		"http://METADATA.GOOGLE.INTERNAL./",
		"http://metadata.goog/",
		"http://168.63.129.16/",
		"https://meta.example.com/v1",
		"https://meta6.example.com/v1",
	])("refuses %s for everyone, main-site admins included", async (input) => {
		for (const allowPrivate of [false, true]) {
			expect(await check(input, allowPrivate)).toMatchObject({ ok: false, code: "not_allowed" });
		}
	});

	it("refuses an address whose name can't be found, and keeps the real reason", async () => {
		for (const input of ["https://nowhere.example.com/v1", "https://slow.example.com/v1", "https://empty.example.com/v1"]) {
			const result = await check(input, true);
			expect(result).toMatchObject({
				ok: false,
				code: "lookup_failed",
				message: "We couldn't find that address. Check the spelling, then try again.",
			});
			expect(result.ok === false && result.cause).toBeInstanceOf(Error);
		}
	});

	it("does not ask DNS about an IP typed in or a name that is local by definition", async () => {
		const quiet = createFakeDns({});
		for (const input of ["http://127.0.0.1/v1", "http://[::1]/v1", "http://x.localhost/v1", "http://metadata.google.internal/"]) {
			await checkServiceAddress({ input, allowPrivate: true, resolveDns: quiet.resolveDns });
		}
		expect(quiet.asked).toEqual([]);
	});

	it.each([
		["", "invalid"],
		["   ", "invalid"],
		["localhost:11434/v1", "invalid"],
		["api.example.com/v1", "invalid"],
		["ftp://api.example.com/v1", "invalid"],
		["file:///etc/passwd", "invalid"],
		["javascript:alert(1)", "invalid"],
		["https://", "invalid"],
		["https://api.example.com/v1?key=abc", "invalid"],
		["https://api.example.com/v1#top", "invalid"],
		["https://user:pass@api.example.com/v1", "has_login"],
		["https://user@api.example.com/v1", "has_login"],
	] as const)("refuses %j as %s", async (input, code) => {
		expect(await check(input, true)).toMatchObject({ ok: false, code });
	});
});
