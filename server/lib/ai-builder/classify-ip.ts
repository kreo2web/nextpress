import { isIPv4, isIPv6 } from "node:net";

/**
 * Where an IP address leads:
 * - `public`: the open internet.
 * - `local`: this machine or a private network (home, office, Docker, VPN), plus ranges that are not routed on the internet.
 * - `blocked`: never allowed for anyone, because these reach the cloud host's own control services or are not real destinations.
 */
export type AddressReach = "public" | "local" | "blocked";

type Ipv4Range = { base: string; prefix: number; reach: AddressReach };

/** First match wins, so the narrow blocked entries sit above the wide local ones. */
const IPV4_RANGES: readonly Ipv4Range[] = [
	{ base: "169.254.0.0", prefix: 16, reach: "blocked" }, // link-local, includes the cloud metadata address
	{ base: "168.63.129.16", prefix: 32, reach: "blocked" }, // Azure host service
	{ base: "100.100.100.200", prefix: 32, reach: "blocked" }, // Alibaba Cloud metadata
	{ base: "224.0.0.0", prefix: 4, reach: "blocked" }, // multicast
	{ base: "240.0.0.0", prefix: 4, reach: "blocked" }, // reserved, includes broadcast
	{ base: "0.0.0.0", prefix: 8, reach: "local" },
	{ base: "10.0.0.0", prefix: 8, reach: "local" },
	{ base: "100.64.0.0", prefix: 10, reach: "local" }, // shared address space (Tailscale, carrier NAT)
	{ base: "127.0.0.0", prefix: 8, reach: "local" },
	{ base: "172.16.0.0", prefix: 12, reach: "local" },
	{ base: "192.168.0.0", prefix: 16, reach: "local" },
	{ base: "192.0.0.0", prefix: 24, reach: "local" },
	{ base: "192.0.2.0", prefix: 24, reach: "local" }, // documentation
	{ base: "198.18.0.0", prefix: 15, reach: "local" }, // benchmarking
	{ base: "198.51.100.0", prefix: 24, reach: "local" }, // documentation
	{ base: "203.0.113.0", prefix: 24, reach: "local" }, // documentation
];

const ipv4ToNumber = (octets: readonly number[]): number =>
	(((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0)) >>> 0;

const isInRange = ({ value, range }: { value: number; range: Ipv4Range }): boolean => {
	const mask = range.prefix === 0 ? 0 : (0xffffffff << (32 - range.prefix)) >>> 0;
	const base = ipv4ToNumber(range.base.split(".").map(Number));
	return (value & mask) >>> 0 === (base & mask) >>> 0;
};

const classifyIpv4Octets = (octets: readonly number[]): AddressReach => {
	const value = ipv4ToNumber(octets);
	return IPV4_RANGES.find((range) => isInRange({ value, range }))?.reach ?? "public";
};

/** Splits a valid IPv6 address into its eight 16-bit groups, expanding `::` and a dotted IPv4 tail. */
const parseIpv6Groups = (address: string): number[] | null => {
	const text = (address.split("%")[0] ?? "").toLowerCase();
	if (!isIPv6(text)) return null;

	const lastColon = text.lastIndexOf(":");
	const tail = text.slice(lastColon + 1);
	let expanded = text;
	if (tail.includes(".")) {
		const octets = tail.split(".").map(Number);
		const high = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16);
		const low = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16);
		expanded = `${text.slice(0, lastColon + 1)}${high}:${low}`;
	}

	const [head = "", rest] = expanded.split("::");
	const headGroups = head === "" ? [] : head.split(":");
	if (rest === undefined) return headGroups.length === 8 ? headGroups.map((group) => parseInt(group, 16)) : null;

	const restGroups = rest === "" ? [] : rest.split(":");
	const zeros = new Array<string>(8 - headGroups.length - restGroups.length).fill("0");
	return [...headGroups, ...zeros, ...restGroups].map((group) => parseInt(group, 16));
};

const embeddedIpv4 = (high: number, low: number): number[] => [high >> 8, high & 0xff, low >> 8, low & 0xff];

const classifyIpv6Groups = (groups: readonly number[]): AddressReach => {
	const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
	const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

	if (firstFiveZero && g5 === 0 && g6 === 0 && g7 <= 1) return "local"; // :: and ::1
	if (firstFiveZero && (g5 === 0xffff || g5 === 0)) return classifyIpv4Octets(embeddedIpv4(g6, g7)); // mapped and old compatible forms
	if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
		return classifyIpv4Octets(embeddedIpv4(g6, g7)); // NAT64 carries an IPv4 address
	}
	if (g0 === 0x2002) return classifyIpv4Octets(embeddedIpv4(g1, g2)); // 6to4 carries an IPv4 address

	if ((g0 & 0xffc0) === 0xfe80) return "blocked"; // link-local
	if ((g0 & 0xff00) === 0xff00) return "blocked"; // multicast
	if (g0 === 0xfd00 && g1 === 0x0ec2) return "blocked"; // AWS metadata
	if (g0 === 0xfd20 && g1 === 0x00ce) return "blocked"; // Google Cloud metadata
	if ((g0 & 0xfe00) === 0xfc00) return "local"; // unique local addresses
	if ((g0 & 0xffc0) === 0xfec0) return "local"; // old site-local
	if (g0 === 0x2001 && g1 === 0x0db8) return "local"; // documentation
	if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return "local"; // discard-only
	return "public";
};

/**
 * Sorts one IP address (IPv4 or IPv6) into public, local or blocked. Anything that can't be read as an
 * address is blocked, so a surprise from the resolver never opens a door.
 */
export function classifyIp(address: string): AddressReach {
	const trimmed = address.trim();
	if (isIPv4(trimmed)) return classifyIpv4Octets(trimmed.split(".").map(Number));
	const groups = parseIpv6Groups(trimmed);
	return groups ? classifyIpv6Groups(groups) : "blocked";
}

const REACH_ORDER: readonly AddressReach[] = ["public", "local", "blocked"];

/** The most restrictive answer wins: one blocked or local address among many makes the whole name that. */
export function strictestReach(reaches: readonly AddressReach[]): AddressReach {
	return reaches.reduce<AddressReach>(
		(worst, next) => (REACH_ORDER.indexOf(next) > REACH_ORDER.indexOf(worst) ? next : worst),
		"public",
	);
}
