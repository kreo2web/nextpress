import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/** The fetch the AI SDK providers accept. Extra undici fields stay off this type. */
export type ProviderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type PinnedFetch = {
	fetch: ProviderFetch;
	/** Closes the undici agent so sockets do not leak after a run. */
	close: () => Promise<void>;
};

const LOOPBACK = ["127.0.0.1", "::1"] as const;

const familyOf = (address: string): 4 | 6 => (isIP(address) === 6 ? 6 : 4);

const pinAddresses = ({ host, addresses }: { host: string; addresses: string[] }): string[] => {
	if (addresses.length > 0) return addresses;
	if (host === "localhost" || host.endsWith(".localhost")) return [...LOOPBACK];
	return [];
};

/**
 * A fetch that never follows redirects. Used for the built-in providers, whose addresses we do not pin.
 */
export const createRefuseRedirectsFetch = (): ProviderFetch => {
	return (input, init) => fetch(input, { ...init, redirect: "error" });
};

/**
 * A fetch that connects only to the IPs `checkServiceAddress` just returned.
 *
 * WHY a custom undici lookup: a second DNS read between the check and the connect is a
 * rebinding window. The agent is passed as the provider fetch's dispatcher so every hop
 * of that call uses the same pins. Redirects are refused.
 */
export const createPinnedFetch = ({
	host,
	addresses,
	redirect = "error",
}: {
	host: string;
	addresses: string[];
	/** `manual` hands a redirect back to the caller, which must check the next address itself. */
	redirect?: "error" | "manual";
}): PinnedFetch => {
	const pinned = pinAddresses({ host, addresses });
	const allowed = new Set([host.toLowerCase(), ...pinned]);

	const agent = new Agent({
		connect: {
			// Node asks for every address (`all: true`) when it races IPv4 and IPv6, and for one otherwise.
			lookup: (hostname, options, callback) => {
				const name = hostname.replace(/^\[|\]$/g, "").toLowerCase();
				if (!allowed.has(name)) {
					callback(new Error(`Refused to connect to ${hostname}: it was not the address that was checked`), "", 4);
					return;
				}
				if (pinned.length === 0) {
					callback(new Error(`Refused to connect to ${hostname}: no pinned address`), "", 4);
					return;
				}
				if (options.all) {
					const all = pinned.map((address) => ({ address, family: familyOf(address) }));
					(callback as (error: null, addresses: Array<{ address: string; family: number }>) => void)(null, all);
					return;
				}
				const first = pinned[0] ?? "";
				callback(null, first, familyOf(first));
			},
		},
	});

	// The providers call fetch(url, init). undici's own Request/Response classes differ from the
	// built-in ones, so the reply is rebuilt as a built-in Response for the AI SDK.
	const fetchFn: ProviderFetch = async (input, init) => {
		const url = input instanceof Request ? input.url : input.toString();
		const reply = await undiciFetch(url, {
			method: init?.method,
			headers: init?.headers as Record<string, string> | undefined,
			body: init?.body as string | Uint8Array | null | undefined,
			signal: init?.signal ?? undefined,
			redirect,
			dispatcher: agent,
		});
		return new Response(reply.body as ReadableStream<Uint8Array> | null, {
			status: reply.status,
			statusText: reply.statusText,
			headers: [...reply.headers.entries()],
		});
	};

	return {
		fetch: fetchFn,
		close: () => agent.close(),
	};
};
