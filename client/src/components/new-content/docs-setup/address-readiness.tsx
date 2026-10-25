import { Fragment, type JSX } from "react";
import { Circle, CircleCheck, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DomainVerifyState } from "@/hooks/use-domain-verify";
import { describeAddressChecks, type CheckRow, type CheckState } from "./describe-address-checks";

type AddressReadinessProps = {
	state: DomainVerifyState;
	/** What was typed, shown while the check runs. */
	host: string;
	/** What to call the A record at the domain provider. */
	recordName: string;
	onCheckAgain: () => void;
};

const STATE_ICON: Record<CheckState, { Icon: typeof Circle; className: string; label: string }> = {
	ok: { Icon: CircleCheck, className: "text-npb-status-success", label: "Ready" },
	waiting: { Icon: TriangleAlert, className: "text-npb-status-warning", label: "Not ready yet" },
	unsure: { Icon: Circle, className: "text-npb-text-muted", label: "Not known yet" },
};

function CheckLine({ row }: { row: CheckRow }): JSX.Element {
	const { Icon, className, label } = STATE_ICON[row.state];
	return (
		<li className="flex gap-3 px-4 py-3 text-sm">
			<Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${className}`} />
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="font-semibold text-npb-text-primary">
					<span className="sr-only">{label}: </span>
					{row.title}
				</span>
				<span className="leading-relaxed text-npb-text-secondary">
					{row.detail.map((part, index) =>
						typeof part === "string" ? (
							<Fragment key={index}>{part}</Fragment>
						) : (
							<strong key={index} className="font-semibold text-npb-text-primary">
								{part.strong}
							</strong>
						),
					)}
				</span>
			</span>
		</li>
	);
}

/**
 * What the address check found for an address of its own: does it point here, and is its
 * certificate ready. The answer comes from the same check Sites uses, in plainer words. Finishing
 * never waits for it: an address that is not ready yet can be connected later.
 */
export function AddressReadiness({ state, host, recordName, onCheckAgain }: AddressReadinessProps): JSX.Element {
	const checks = state.kind === "ready" ? describeAddressChecks({ data: state.data, recordName }) : null;
	return (
		<div role="status" aria-live="polite" className="grid gap-2">
			{state.kind === "idle" ? (
				<p className="text-xs text-npb-text-muted">We check the address when you pick it or leave the box.</p>
			) : null}
			{state.kind === "verifying" ? (
				<p className="flex items-center gap-2 text-sm text-npb-text-secondary">
					<Loader2 aria-hidden className="size-4 animate-spin" />
					Checking {host}…
				</p>
			) : null}
			{state.kind === "error" ? (
				<p className="text-sm text-npb-text-secondary">We couldn't check this address right now. {state.message}</p>
			) : null}
			{checks ? (
				<ul className="divide-y divide-npb-divider rounded-[var(--npb-radius-surface)] border border-npb-border-strong bg-npb-surface-base">
					<CheckLine row={checks.pointsHere} />
					<CheckLine row={checks.certificate} />
				</ul>
			) : null}
			{state.kind === "ready" || state.kind === "error" ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<p className="min-w-0 flex-1 text-xs leading-relaxed text-npb-text-muted">
						You can finish now. Until the address is ready, the docs open from the admin preview.
					</p>
					<Button type="button" variant="ghost" size="sm" onClick={onCheckAgain}>
						<RefreshCw aria-hidden />
						Check again
					</Button>
				</div>
			) : null}
		</div>
	);
}
