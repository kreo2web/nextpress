import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useActiveSite } from "@/hooks/useActiveSite";
import { useSiteDocs } from "@/hooks/use-site-docs";
import { useSiteAccess } from "@/hooks/use-site-access";
import { useDomainVerify, type DomainVerifyState } from "@/hooks/use-domain-verify";
import { useToast } from "@/hooks/use-toast";
import { DOCS_QUERY_KEY, createDocs, docsPageEditorPath } from "@/lib/docs/docs-api";
import { attachSiteAddress, createDocsSite, setSiteHomepage } from "@/lib/docs/docs-site-api";
import { siteBaseDomain, type DocsAddress, type DocsPlace } from "@/lib/docs/docs-address";
import {
	DEFAULT_DOCS_SETUP_VALUES,
	buildDocsSetupPlan,
	findFirstInvalidStep,
	readDocsAddress,
	suggestDocsPath,
	validateDocsSetupStep,
	type DocsSetupContext,
	type DocsSetupErrors,
	type DocsSetupStep,
	type DocsSetupValues,
} from "./docs-setup-form";
import { createDocsSetupRunner, type DocsSetupApi, type DocsSetupOutcome, type SetupStage } from "./docs-setup-run";
import { describeSetupOutcome } from "./describe-setup-outcome";

const docsSetupApi: DocsSetupApi = {
	createSite: createDocsSite,
	createDocs,
	setHomepage: setSiteHomepage,
	attachAddress: attachSiteAddress,
};

const NOT_MAIN_ADMIN = "Only the main site's admins can add a new address.";

export type SetupRunState =
	| { status: "idle" }
	| { status: "working"; stage: SetupStage | null }
	| { status: "failed"; message: string };

export type DocsSetup = {
	values: DocsSetupValues;
	step: DocsSetupStep;
	errors: DocsSetupErrors;
	/** The current site's address, which "On this site" and "On a separate address" both build on. */
	base: string;
	context: DocsSetupContext;
	address: DocsAddress;
	/** Whether this person may give the docs an address of their own, and why not if they can't. */
	ownAddress: { allowed: boolean; reason: string | null };
	check: { state: DomainVerifyState; run: () => void };
	run: SetupRunState;
	setValue: <K extends keyof DocsSetupValues>(key: K, value: DocsSetupValues[K]) => void;
	setPlace: (place: DocsPlace) => void;
	setAddressPart: (text: string) => void;
	goBack: () => void;
	goTo: (step: DocsSetupStep) => void;
	goNext: () => void;
};

const nextStepOf: Record<1 | 2, DocsSetupStep> = { 1: 2, 2: 3 };
const addressFieldKeys: (keyof DocsSetupValues)[] = ["place", "path", "subdomain"];

/**
 * Everything the docs setup does apart from drawing it: the answers so far, the three steps and
 * their checks, the address check of an own address, and the finish that makes the docs and opens
 * the editor on them. The screen only draws what this returns.
 */
export function useDocsSetup({ onClose }: { onClose: () => void }): DocsSetup {
	const { activeSite, activeSiteId, sites, setActiveSiteId } = useActiveSite();
	const access = useSiteAccess();
	const [, setLocation] = useLocation();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const domainCheck = useDomainVerify();
	const [runner] = useState(() => createDocsSetupRunner({ api: docsSetupApi }));
	const working = useRef(false);

	const [values, setValues] = useState<DocsSetupValues>(DEFAULT_DOCS_SETUP_VALUES);
	const [step, setStep] = useState<DocsSetupStep>(1);
	const [errors, setErrors] = useState<DocsSetupErrors>({});
	const [run, setRun] = useState<SetupRunState>({ status: "idle" });

	const base = siteBaseDomain(activeSite?.siteUrl);
	const otherDocs = useSiteDocs({ siteId: activeSiteId }).data;
	const takenPaths = useMemo(() => (otherDocs ?? []).map((entry) => entry.path.replace(/^\/+/, "")), [otherDocs]);
	const context = useMemo<DocsSetupContext>(() => ({ base, sites, takenPaths }), [base, sites, takenPaths]);
	/** Until someone types an address, the Where step offers a free one (`suggestDocsPath`). */
	const pathTyped = useRef(false);
	const address = readDocsAddress({ values, context });
	const ownAddress = access.isMainSiteAdmin ? { allowed: true, reason: null } : { allowed: false, reason: NOT_MAIN_ADMIN };

	const setValue: DocsSetup["setValue"] = (key, value) => {
		setValues((current) => ({ ...current, [key]: value }));
		setErrors((current) => {
			if (key === "name") return { ...current, name: undefined };
			if (addressFieldKeys.includes(key)) return { ...current, address: undefined };
			return current;
		});
	};

	/** Checks the typed address when it is a plausible one; a half-typed word is not worth asking about. */
	const checkTyped = useCallback(
		(next: DocsSetupValues) => {
			const typed = readDocsAddress({ values: next, context });
			const problem = validateDocsSetupStep({ step: 2, values: next, context });
			if (next.place === "own-address" && !problem.address) domainCheck.verify(typed.host);
		},
		[context, domainCheck.verify],
	);

	const setPlace = (place: DocsPlace): void => {
		const next = { ...values, place };
		setValue("place", place);
		domainCheck.reset();
		checkTyped(next);
	};

	const setAddressPart = (text: string): void => {
		if (values.place === "this-site") pathTyped.current = true;
		setValue(values.place === "own-address" ? "subdomain" : "path", text);
		domainCheck.reset();
	};

	const check = { state: domainCheck.state, run: () => checkTyped(values) };

	const leaveStep = (target: DocsSetupStep): void => {
		setRun({ status: "idle" });
		setStep(target);
	};

	const finishWith = async ({ outcome, asked }: { outcome: Extract<DocsSetupOutcome, { ok: true }>; asked: string }): Promise<void> => {
		void queryClient.invalidateQueries({ queryKey: [DOCS_QUERY_KEY] });
		void queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
		if (outcome.ownSite) {
			// The new site must be in the list before it is picked, or the picker falls back to the old one.
			await queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
			setActiveSiteId(outcome.siteId);
		}
		toast(describeSetupOutcome({ outcome, asked }));
		setLocation(docsPageEditorPath(outcome.homeId));
		onClose();
	};

	const finish = async (): Promise<void> => {
		if (working.current) return;
		const invalid = findFirstInvalidStep({ values, context });
		if (invalid) {
			setErrors(invalid.errors);
			leaveStep(invalid.step);
			return;
		}
		const plan = buildDocsSetupPlan({ values, context, activeSiteId });
		working.current = true;
		setRun({ status: "working", stage: null });
		const outcome = await runner.run({ plan, onStage: (stage) => setRun({ status: "working", stage }) });
		working.current = false;
		if (!outcome.ok) {
			setRun({ status: "failed", message: outcome.message });
			if (outcome.at === "site") {
				setErrors({ address: outcome.message });
				setStep(2);
			}
			return;
		}
		await finishWith({ outcome, asked: plan.docs.slug });
	};

	const goNext = (): void => {
		const found = validateDocsSetupStep({ step, values, context });
		if (Object.keys(found).length > 0) {
			setErrors(found);
			return;
		}
		setErrors({});
		if (step === 3) {
			void finish();
			return;
		}
		if (step === 1 && !pathTyped.current) setValue("path", suggestDocsPath({ name: values.name, takenPaths }));
		leaveStep(nextStepOf[step]);
	};

	const goBack = (): void => {
		if (step > 1) leaveStep((step - 1) as DocsSetupStep);
	};

	const goTo = (target: DocsSetupStep): void => {
		if (target < step) leaveStep(target);
	};

	return {
		values,
		step,
		errors,
		base,
		context,
		address,
		ownAddress,
		check,
		run,
		setValue,
		setPlace,
		setAddressPart,
		goBack,
		goTo,
		goNext,
	};
}
