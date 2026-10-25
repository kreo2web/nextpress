import type { DomainReadinessData } from "@/hooks/use-domain-verify";

/**
 * The address check (`GET /api/setup/verify-domain`) says it in server words. This turns the same
 * answer into the two things a person asks of a new address: does it point here, and is its
 * certificate ready. Pure, so the wording is tested without a screen.
 */

export type CheckState = "ok" | "waiting" | "unsure";

/** Text, with the parts a person has to copy (a record name, an address) marked as strong. */
export type CheckDetail = (string | { strong: string })[];

export type CheckRow = { state: CheckState; title: string; detail: CheckDetail };

export type AddressChecks = { pointsHere: CheckRow; certificate: CheckRow };

/** The detail as one plain string, for tests and screen readers. */
export const flattenDetail = (detail: CheckDetail): string =>
	detail.map((part) => (typeof part === "string" ? part : part.strong)).join("");

const describePointsHere = ({ data, recordName }: { data: DomainReadinessData; recordName: string }): CheckRow => {
	const name = data.normalizedInput;
	const main = data.dns[data.checkedHostnames[0] ?? name];
	const expectedIp = data.ipMatch.expectedIp;

	if (main?.skipped) {
		return { state: "ok", title: `${name} is a local address`, detail: ["No domain settings are needed. It works on this computer."] };
	}
	if (!main?.ok) {
		return {
			state: "waiting",
			title: `${name} doesn't point here yet`,
			detail: expectedIp
				? ["At your domain provider, add an A record named ", { strong: recordName }, " with the value ", { strong: expectedIp }, "."]
				: ["At your domain provider, add an A record named ", { strong: recordName }, " that points to this server."],
		};
	}
	if (data.ipMatch.skipped) {
		return {
			state: "unsure",
			title: `${name} has an address`,
			detail: [`It points to ${main.addresses.join(", ")}. We can't tell if that is this server.`],
		};
	}
	if (!data.ipMatch.ok) {
		return {
			state: "waiting",
			title: `${name} points somewhere else`,
			detail: expectedIp
				? [`It points to ${main.addresses.join(", ")}. Change its A record to `, { strong: expectedIp }, "."]
				: [`It points to ${main.addresses.join(", ")}, not to this server.`],
		};
	}
	return { state: "ok", title: `${name} points here`, detail: ["Its address matches this server."] };
};

const describeCertificate = ({ data, pointsHere }: { data: DomainReadinessData; pointsHere: CheckRow }): CheckRow => {
	const main = data.dns[data.checkedHostnames[0] ?? data.normalizedInput];
	if (main?.skipped) {
		return { state: "ok", title: "No certificate needed", detail: ["Local addresses use plain http."] };
	}
	if (data.caddy.ok && !data.caddy.skipped) {
		return { state: "ok", title: "Certificate is ready", detail: ["Visitors get a secure connection."] };
	}
	if (pointsHere.state !== "waiting") {
		return { state: "unsure", title: "Certificate", detail: ["Set up by itself. It can take a few minutes."] };
	}
	return { state: "waiting", title: "Certificate", detail: ["Set up by itself once the address points here."] };
};

/** `recordName` is what to call the A record at the domain provider (`docs` for `docs.example.com`). */
export function describeAddressChecks({
	data,
	recordName,
}: {
	data: DomainReadinessData;
	recordName: string;
}): AddressChecks {
	const pointsHere = describePointsHere({ data, recordName });
	return { pointsHere, certificate: describeCertificate({ data, pointsHere }) };
}
