import type { DocsSetupOutcome } from "./docs-setup-run";

type Finished = Extract<DocsSetupOutcome, { ok: true }>;

/** What the "docs are ready" message says. Plain words only: no steps, no server names. */
export type SetupAnnouncement = { title: string; description: string | null };

const ready = "Your docs are ready";

/**
 * The message after a setup that worked. `asked` is the address part the person typed: when the
 * server had to pick another because it was taken, they are told where the docs really are.
 */
export function describeSetupOutcome({ outcome, asked }: { outcome: Finished; asked: string }): SetupAnnouncement {
	const moved = outcome.path !== `/${asked}`;
	const movedNote = moved ? `They are at ${outcome.path} because /${asked} was taken.` : null;

	if (!outcome.ownSite) return { title: ready, description: movedNote };

	const { address } = outcome;
	if (address.state === "attached") {
		const notice = address.notice ? ` ${address.notice}` : "";
		return {
			title: ready,
			description: `${address.host} is connected. You are now working on that site.${notice}${movedNote ? ` ${movedNote}` : ""}`,
		};
	}
	if (address.state === "waiting") {
		return {
			title: ready,
			description: `${address.host} isn't connected yet. ${address.reason} Until it is, the docs open from the admin preview. Add the address in Sites once it points here. You are now working on the docs site.`,
		};
	}
	return { title: ready, description: movedNote };
}
