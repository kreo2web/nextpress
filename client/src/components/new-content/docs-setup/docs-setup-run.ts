import type { CreateDocsInput, CreateDocsResult } from "@shared/docs";
import type { SiteSaveResult } from "@/lib/docs/docs-site-api";
import type { DocsSetupPlan } from "./docs-setup-form";

/**
 * Makes the docs the setup describes, one step at a time. Docs on their own address are a site of
 * their own, so that path is four calls (site, docs, homepage, address) and any of the first
 * three can fail on its own. The runner remembers what it already made, so pressing "Try again"
 * carries on from the failed step instead of making a second site.
 */

export type DocsSetupApi = {
	createSite: (input: { name: string }) => Promise<SiteSaveResult>;
	createDocs: (input: CreateDocsInput) => Promise<CreateDocsResult>;
	setHomepage: (input: { siteId: string; slug: string }) => Promise<void>;
	attachAddress: (input: { siteId: string; host: string }) => Promise<SiteSaveResult>;
};

export type SetupStage = "site" | "docs" | "homepage" | "address";

/** What happened to the new address. It never fails the setup: the docs exist either way. */
export type AddressOutcome =
	| { state: "none" }
	| { state: "attached"; host: string; notice: string | null }
	| { state: "waiting"; host: string; reason: string };

export type DocsSetupOutcome =
	| {
			ok: true;
			siteId: string;
			homeId: string;
			/** Where the home page really is: `/docs-2` if `/docs` was taken. */
			path: string;
			ownSite: boolean;
			address: AddressOutcome;
	  }
	| { ok: false; at: "site" | "docs" | "homepage"; message: string };

type SetupProgress = { siteId?: string; docs?: CreateDocsResult; homepageSet?: boolean };

type Attempt<T> = { ok: true; value: T } | { ok: false; message: string };

type HttpFailure = Error & { status?: number };

const hasStatus = (error: Error): error is HttpFailure & { status: number } =>
	typeof (error as HttpFailure).status === "number";

/** The server's plain sentence when it sent one; ours when the call never reached it (offline, blocked). */
const readableMessage = ({ error, fallback }: { error: Error; fallback: string }): string =>
	hasStatus(error) && error.message.trim() ? error.message.trim() : fallback;

/** Runs one call; a failure is logged with the ids that explain it and handed back as a plain message. */
async function attempt<T>({
	work,
	atFunction,
	ids,
	fallback,
}: {
	work: () => Promise<T>;
	atFunction: string;
	ids: Record<string, string>;
	fallback: string;
}): Promise<Attempt<T>> {
	try {
		return { ok: true, value: await work() };
	} catch (caught) {
		const error = caught instanceof Error ? caught : new Error(String(caught));
		console.error({ atFunction, data: { ...ids, error }, message: "A docs setup step failed" });
		return { ok: false, message: readableMessage({ error, fallback }) };
	}
}

const homeSlugOf = (path: string): string => path.replace(/^\/+/, "");

export function createDocsSetupRunner({ api }: { api: DocsSetupApi }) {
	let progress: SetupProgress = {};

	const makeSite = async ({ plan, onStage }: { plan: DocsSetupPlan; onStage: (stage: SetupStage) => void }): Promise<Attempt<string>> => {
		if (progress.siteId) return { ok: true, value: progress.siteId };
		onStage("site");
		const made = await attempt({
			work: () => api.createSite({ name: plan.docs.name }),
			atFunction: "docsSetup.createSite",
			ids: { activeSiteId: plan.activeSiteId, host: plan.host },
			fallback: "We couldn't create the new address. Check your connection and try again.",
		});
		if (!made.ok) return made;
		progress = { ...progress, siteId: made.value.site.id };
		return { ok: true, value: made.value.site.id };
	};

	const makeDocs = async ({
		plan,
		siteId,
		onStage,
	}: {
		plan: DocsSetupPlan;
		siteId: string;
		onStage: (stage: SetupStage) => void;
	}): Promise<Attempt<CreateDocsResult>> => {
		if (progress.docs) return { ok: true, value: progress.docs };
		onStage("docs");
		const made = await attempt({
			work: () => api.createDocs({ ...plan.docs, siteId }),
			atFunction: "docsSetup.createDocs",
			ids: { siteId },
			fallback: "We couldn't set up your docs. Check your connection and try again.",
		});
		if (!made.ok) {
			const own = plan.place === "own-address";
			return own ? { ok: false, message: `The new site was made, but your docs couldn't be set up in it. ${made.message}` } : made;
		}
		progress = { ...progress, docs: made.value };
		return made;
	};

	const makeHomepage = async ({
		plan,
		siteId,
		docs,
		onStage,
	}: {
		plan: DocsSetupPlan;
		siteId: string;
		docs: CreateDocsResult;
		onStage: (stage: SetupStage) => void;
	}): Promise<Attempt<true>> => {
		if (progress.homepageSet) return { ok: true, value: true };
		onStage("homepage");
		const failure = `Your docs are created, but we couldn't make them the front page of ${plan.host}. Try again.`;
		const set = await attempt({
			work: () => api.setHomepage({ siteId, slug: homeSlugOf(docs.docs.path) }),
			atFunction: "docsSetup.setHomepage",
			ids: { siteId, homeId: docs.homeId },
			fallback: failure,
		});
		if (!set.ok) return { ok: false, message: failure };
		progress = { ...progress, homepageSet: true };
		return { ok: true, value: true };
	};

	const attachAddress = async ({
		plan,
		siteId,
		onStage,
	}: {
		plan: DocsSetupPlan;
		siteId: string;
		onStage: (stage: SetupStage) => void;
	}): Promise<AddressOutcome> => {
		onStage("address");
		const attached = await attempt({
			work: () => api.attachAddress({ siteId, host: plan.host }),
			atFunction: "docsSetup.attachAddress",
			ids: { siteId, host: plan.host },
			fallback: `${plan.host} could not be connected yet.`,
		});
		return attached.ok
			? { state: "attached", host: plan.host, notice: attached.value.notice }
			: { state: "waiting", host: plan.host, reason: attached.message };
	};

	/** Makes the docs; safe to call again after a failure. */
	const run = async ({
		plan,
		onStage,
	}: {
		plan: DocsSetupPlan;
		onStage: (stage: SetupStage) => void;
	}): Promise<DocsSetupOutcome> => {
		const own = plan.place === "own-address";
		let siteId = plan.activeSiteId;
		if (own) {
			const site = await makeSite({ plan, onStage });
			if (!site.ok) return { ok: false, at: "site", message: site.message };
			siteId = site.value;
		}
		const docs = await makeDocs({ plan, siteId, onStage });
		if (!docs.ok) return { ok: false, at: "docs", message: docs.message };
		if (own) {
			const homepage = await makeHomepage({ plan, siteId, docs: docs.value, onStage });
			if (!homepage.ok) return { ok: false, at: "homepage", message: homepage.message };
		}
		const address: AddressOutcome = own ? await attachAddress({ plan, siteId, onStage }) : { state: "none" };
		return { ok: true, siteId, homeId: docs.value.homeId, path: docs.value.docs.path, ownSite: own, address };
	};

	return { run };
}

export type DocsSetupRunner = ReturnType<typeof createDocsSetupRunner>;
