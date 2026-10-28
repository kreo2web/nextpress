import type { CreateDocsInput } from "@shared/docs";
import type { ActiveSiteItem } from "@/hooks/useActiveSite";
import {
	buildDocsAddress,
	findSiteUsingHost,
	normalizeAddressPart,
	validateAddressPart,
	validateFullHost,
	validateSubdomain,
	type DocsAddress,
	type DocsPlace,
} from "@/lib/docs/docs-address";

/**
 * What the docs setup asks, the checks on each step, and the plan the last step hands to the
 * runner. Pure, so every rule is tested without a screen.
 */

export type DocsSetupValues = {
	name: string;
	/** An empty string means no logo. */
	logoUrl: string;
	place: DocsPlace;
	/** On this site: the address part, `docs` in `example.com/docs`. */
	path: string;
	/** Own address: the first part, `docs` in `docs.example.com`. */
	subdomain: string;
	search: boolean;
	sidebar: boolean;
	toc: boolean;
	prevNext: boolean;
	copyPage: boolean;
};

export const DEFAULT_DOCS_SETUP_VALUES: DocsSetupValues = {
	name: "",
	logoUrl: "",
	place: "this-site",
	path: "docs",
	subdomain: "docs",
	search: true,
	sidebar: true,
	toc: true,
	prevNext: true,
	copyPage: true,
};

export type DocsSetupStep = 1 | 2 | 3;

export const DOCS_SETUP_STEP_LIST: { step: DocsSetupStep; title: string; blurb: string }[] = [
	{ step: 1, title: "Name", blurb: "What your docs are called" },
	{ step: 2, title: "Where they live", blurb: "On this site or a separate address" },
	{ step: 3, title: "What they have", blurb: "Search, sidebar, page tools" },
];

/** What a step found wrong, by the field it belongs to. */
export type DocsSetupErrors = { name?: string; address?: string };

export type DocsSetupContext = {
	/** The current site's address without scheme or `www.`; empty when the site has no address. */
	base: string;
	sites: ActiveSiteItem[];
	/** Address parts the site's other docs already use: `docs` for docs at `/docs`. */
	takenPaths: readonly string[];
};

const MAX_NAME_LENGTH = 200;

const validateName = (name: string): string | undefined => {
	const typed = name.trim();
	if (!typed) return "Give your docs a name.";
	if (typed.length > MAX_NAME_LENGTH) return `Keep the name under ${MAX_NAME_LENGTH} letters.`;
	return undefined;
};

const addressOf = ({ values, context }: { values: DocsSetupValues; context: DocsSetupContext }): DocsAddress =>
	buildDocsAddress({ place: values.place, path: values.path, subdomain: values.subdomain, base: context.base });

const validateAddress = ({ values, context }: { values: DocsSetupValues; context: DocsSetupContext }): string | undefined => {
	if (values.place === "this-site") {
		const typedError = validateAddressPart(values.path);
		if (typedError) return typedError;
		const part = normalizeAddressPart(values.path);
		return context.takenPaths.includes(part) ? `Other docs on this site already use /${part}. Pick another address.` : undefined;
	}
	const typedError = context.base ? validateSubdomain(values.subdomain) : validateFullHost(values.subdomain);
	if (typedError) return typedError;
	const owner = findSiteUsingHost({ sites: context.sites, host: addressOf({ values, context }).host });
	return owner ? `${owner.name?.trim() || "Another site"} already uses this address.` : undefined;
};

/** An address part made from the docs' name: "API Reference" becomes `api-reference`. */
const addressPartFromName = (name: string): string =>
	name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/**
 * The address the Where step starts with: `docs`, or, when other docs already use it, one made
 * from the name (numbered if that is taken too), so a second docs never lands on `/docs-2` unseen.
 */
export function suggestDocsPath({ name, takenPaths }: { name: string; takenPaths: readonly string[] }): string {
	const first = DEFAULT_DOCS_SETUP_VALUES.path;
	if (!takenPaths.includes(first)) return first;
	const base = addressPartFromName(name) || first;
	const candidates = Array.from({ length: takenPaths.length + 1 }, (_, index) => (index === 0 ? base : `${base}-${index + 1}`));
	return candidates.find((candidate) => !takenPaths.includes(candidate)) ?? base;
}

/** The problems on one step. Step 3 only has switches, so it can't be wrong. */
export function validateDocsSetupStep({
	step,
	values,
	context,
}: {
	step: DocsSetupStep;
	values: DocsSetupValues;
	context: DocsSetupContext;
}): DocsSetupErrors {
	const checks: Record<DocsSetupStep, () => DocsSetupErrors> = {
		1: () => {
			const name = validateName(values.name);
			return name ? { name } : {};
		},
		2: () => {
			const address = validateAddress({ values, context });
			return address ? { address } : {};
		},
		3: () => ({}),
	};
	return checks[step]();
}

/** The first step with a problem, so Finish can send people back to it. */
export function findFirstInvalidStep({
	values,
	context,
}: {
	values: DocsSetupValues;
	context: DocsSetupContext;
}): { step: DocsSetupStep; errors: DocsSetupErrors } | null {
	const steps: DocsSetupStep[] = [1, 2, 3];
	for (const step of steps) {
		const errors = validateDocsSetupStep({ step, values, context });
		if (Object.keys(errors).length > 0) return { step, errors };
	}
	return null;
}

/** Everything the runner needs from the form, with the site and address already worked out. */
export type DocsSetupPlan = {
	place: DocsPlace;
	/** The site the setup was opened on. */
	activeSiteId: string;
	/** Own address: the whole address to attach to the new site. */
	host: string;
	/** What `POST /api/docs` takes, without the site (a new site has no id yet). */
	docs: Omit<CreateDocsInput, "siteId">;
};

export function buildDocsSetupPlan({
	values,
	context,
	activeSiteId,
}: {
	values: DocsSetupValues;
	context: DocsSetupContext;
	activeSiteId: string;
}): DocsSetupPlan {
	const address = addressOf({ values, context });
	const logoUrl = values.logoUrl.trim();
	return {
		place: values.place,
		activeSiteId,
		host: values.place === "own-address" ? address.host : "",
		docs: {
			name: values.name.trim(),
			slug: address.slug,
			...(logoUrl ? { logoUrl } : {}),
			search: values.search,
			features: { sidebar: values.sidebar, toc: values.toc, prevNext: values.prevNext, copyPage: values.copyPage },
			// On an address of its own the docs is the site's homepage, so its pages start at the site root.
			...(values.place === "own-address" ? { ownAddress: true } : {}),
		},
	};
}

export const readDocsAddress = ({ values, context }: { values: DocsSetupValues; context: DocsSetupContext }): DocsAddress =>
	addressOf({ values, context });

/** The short line under a step in the rail once it is done. */
export function summarizeDocsSetupStep({
	step,
	values,
	context,
}: {
	step: DocsSetupStep;
	values: DocsSetupValues;
	context: DocsSetupContext;
}): string {
	if (step === 1) return values.name.trim();
	if (step === 2) return addressOf({ values, context }).display;
	const on = [
		values.search && "Search",
		values.sidebar && "Sidebar",
		values.toc && "On this page",
		values.prevNext && "Previous / next",
		values.copyPage && "Copy page",
	].filter((label): label is string => typeof label === "string");
	if (on.length === 0) return "Nothing extra";
	return on.length <= 2 ? on.join(", ") : `${on.slice(0, 2).join(", ")} and ${on.length - 2} more`;
}
