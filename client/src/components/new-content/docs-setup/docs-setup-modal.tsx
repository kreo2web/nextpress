import { useEffect, useRef, useState, type JSX } from "react";
import { BookOpen, Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FullPageModal } from "@/components/ui/full-page-modal";
import type { DocsSetupStep } from "./docs-setup-form";
import { DocsSetupFeaturesStep } from "./docs-setup-features-step";
import { DocsSetupNameStep } from "./docs-setup-name-step";
import { DocsSetupPreview } from "./docs-setup-preview";
import { DocsSetupProgress, DocsSetupRail } from "./docs-setup-rail";
import { DocsSetupWhereStep } from "./docs-setup-where-step";
import type { SetupStage } from "./docs-setup-run";
import { useDocsSetup, type DocsSetup } from "./use-docs-setup";

const STEP_COPY: Record<DocsSetupStep, { title: string; blurb: string }> = {
	1: { title: "What are your docs called?", blurb: "This is the name at the top of every docs page. You can change it later." },
	2: { title: "Where do your docs live?", blurb: "You can change this later in the docs settings." },
	3: { title: "What do your docs have?", blurb: "Everything here can be changed later in the editor." },
};

const STAGE_LABEL: Record<SetupStage, string> = {
	site: "Creating the new site…",
	docs: "Setting up your docs…",
	homepage: "Making them the front page…",
	address: "Connecting the address…",
};

function buttonLabel({ step, run }: Pick<DocsSetup, "step" | "run">): string {
	if (run.status === "working") return run.stage ? STAGE_LABEL[run.stage] : "Setting up your docs…";
	if (step < 3) return "Continue";
	return run.status === "failed" ? "Try again" : "Create docs";
}

function SetupFooter({ setup, onCancel }: { setup: DocsSetup; onCancel: () => void }): JSX.Element {
	const working = setup.run.status === "working";
	const label = buttonLabel(setup);
	return (
		<div className="flex items-center gap-3">
			<p className="mr-auto min-w-0 truncate text-sm text-npb-text-secondary">Step {setup.step} of 3</p>
			{setup.step === 1 ? (
				<Button type="button" variant="outline" onClick={onCancel} disabled={working}>
					Cancel
				</Button>
			) : (
				<Button type="button" variant="outline" onClick={setup.goBack} disabled={working}>
					Back
				</Button>
			)}
			<Button type="button" onClick={setup.goNext} disabled={working}>
				{working ? <Loader2 aria-hidden className="animate-spin" /> : null}
				{label}
			</Button>
			<p role="status" className="sr-only">
				{working ? label : ""}
			</p>
		</div>
	);
}

/**
 * Making docs, once per site: a name, where they live, what they have. Each step has the docs
 * frame drawn beside it, changing as the answers do. Finishing makes the docs and opens the
 * editor on them.
 */
export function DocsSetupModal({ onClose }: { onClose: () => void }): JSX.Element {
	const setup = useDocsSetup({ onClose });
	const { step, values, errors, run, context, address } = setup;
	const working = run.status === "working";
	const headingRef = useRef<HTMLHeadingElement>(null);
	const arrived = useRef(false);
	const [previewOpen, setPreviewOpen] = useState(false);

	// A new step starts at its heading, so screen readers hear where they are. Not on the first one: its box has focus.
	useEffect(() => {
		if (arrived.current) headingRef.current?.focus();
		arrived.current = true;
	}, [step]);

	const preview = (
		<DocsSetupPreview
			name={values.name}
			logoUrl={values.logoUrl.trim()}
			address={address.display}
			search={values.search}
			sidebar={values.sidebar}
			toc={values.toc}
			prevNext={values.prevNext}
			copyPage={values.copyPage}
		/>
	);

	const stepBodies: Record<DocsSetupStep, JSX.Element> = {
		1: <DocsSetupNameStep values={values} errors={errors} setValue={setup.setValue} disabled={working} />,
		2: <DocsSetupWhereStep setup={setup} disabled={working} />,
		3: <DocsSetupFeaturesStep values={values} setValue={setup.setValue} disabled={working} />,
	};

	return (
		<FullPageModal
			open
			onOpenChange={(open) => !open && onClose()}
			locked={working}
			title="Set up your docs"
			description="Name your docs, choose where they live and what they have."
			icon={<BookOpen className="size-4" aria-hidden />}
			bodyClassName="lg:overflow-hidden"
			footer={<SetupFooter setup={setup} onCancel={onClose} />}
		>
			<div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
				<DocsSetupRail step={step} values={values} context={context} onGoTo={setup.goTo} />
				<section aria-labelledby="docs-setup-heading" className="min-w-0 flex-1 px-5 py-6 sm:px-10 sm:py-9 lg:overflow-y-auto">
					<div className="mx-auto grid max-w-xl gap-6">
						<DocsSetupProgress step={step} />
						<header className="grid gap-1.5">
							<h2
								id="docs-setup-heading"
								ref={headingRef}
								tabIndex={-1}
								className="text-xl font-semibold tracking-tight text-npb-text-primary outline-none sm:text-2xl"
							>
								{STEP_COPY[step].title}
							</h2>
							<p className="text-sm text-npb-text-secondary">{STEP_COPY[step].blurb}</p>
						</header>
						{stepBodies[step]}
						{run.status === "failed" && step === 3 ? (
							<Alert variant="destructive">
								<TriangleAlert aria-hidden />
								<AlertTitle>We couldn't finish setting up your docs</AlertTitle>
								<AlertDescription>{run.message}</AlertDescription>
							</Alert>
						) : null}
						<Collapsible open={previewOpen} onOpenChange={setPreviewOpen} className="xl:hidden">
							<CollapsibleTrigger asChild>
								<Button type="button" variant="outline" size="sm">
									{previewOpen ? "Hide preview" : "Show preview"}
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-4">{previewOpen ? preview : null}</CollapsibleContent>
						</Collapsible>
					</div>
				</section>
				<div className="hidden flex-1 overflow-y-auto bg-npb-canvas-bg p-10 xl:block">{preview}</div>
			</div>
		</FullPageModal>
	);
}
