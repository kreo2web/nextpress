import type { JSX } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	DOCS_SETUP_STEP_LIST,
	summarizeDocsSetupStep,
	type DocsSetupContext,
	type DocsSetupStep,
	type DocsSetupValues,
} from "./docs-setup-form";

type RailProps = {
	step: DocsSetupStep;
	values: DocsSetupValues;
	context: DocsSetupContext;
	onGoTo: (step: DocsSetupStep) => void;
};

function Marker({ number, state }: { number: number; state: "done" | "current" | "todo" }): JSX.Element {
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
				state === "done" && "border border-npb-border-strong bg-npb-surface-inset text-npb-text-primary",
				state === "current" && "bg-npb-interactive-emphasis-bg text-npb-interactive-emphasis-text",
				state === "todo" && "border border-npb-border-strong text-npb-text-secondary",
			)}
		>
			{state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : number}
		</span>
	);
}

/**
 * The three steps down the left on wide screens. Finished steps say what was chosen and can be
 * opened again; steps ahead are plain text, so nobody skips what hasn't been asked yet.
 */
export function DocsSetupRail({ step, values, context, onGoTo }: RailProps): JSX.Element {
	return (
		<nav aria-label="Steps" className="hidden w-64 shrink-0 overflow-y-auto border-r border-npb-divider p-5 lg:block">
			<ol className="grid gap-1.5">
				{DOCS_SETUP_STEP_LIST.map((item) => {
					const state = item.step < step ? "done" : item.step === step ? "current" : "todo";
					const summary = state === "done" ? summarizeDocsSetupStep({ step: item.step, values, context }) : item.blurb;
					const body = (
						<>
							<Marker number={item.step} state={state} />
							<span className="grid min-w-0 gap-0.5">
								<span className={cn("text-sm font-semibold", state === "todo" ? "text-npb-text-secondary" : "text-npb-text-primary")}>
									{item.title}
								</span>
								<span className="truncate text-xs text-npb-text-muted">{summary}</span>
							</span>
						</>
					);
					return (
						<li key={item.step}>
							{state === "done" ? (
								<button
									type="button"
									onClick={() => onGoTo(item.step)}
									className="flex w-full gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-npb-interactive-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus"
								>
									{body}
								</button>
							) : (
								<div
									aria-current={state === "current" ? "step" : undefined}
									className={cn("flex gap-3 rounded-lg p-2.5", state === "current" && "bg-npb-surface-inset")}
								>
									{body}
								</div>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

/** Three bars for the phone layout, where the rail has no room. */
export function DocsSetupProgress({ step }: { step: DocsSetupStep }): JSX.Element {
	return (
		<div aria-hidden className="flex gap-1.5 lg:hidden">
			{DOCS_SETUP_STEP_LIST.map((item) => (
				<span key={item.step} className={cn("h-1 flex-1 rounded-full", item.step <= step ? "bg-npb-accent" : "bg-npb-surface-inset")} />
			))}
		</div>
	);
}
