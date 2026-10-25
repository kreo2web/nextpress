import type { JSX } from "react";
import { Copy, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocsPreviewProps = {
	name: string;
	logoUrl: string;
	/** The address people would type, like `example.com/docs`. */
	address: string;
	search: boolean;
	sidebar: boolean;
	toc: boolean;
	prevNext: boolean;
	copyPage: boolean;
};

const bar = "rounded-full bg-npb-surface-inset";

function PreviewSidebar(): JSX.Element {
	return (
		<div className="flex w-28 shrink-0 flex-col gap-2 border-r border-npb-divider p-3 text-[11px] sm:w-36">
			<span className="font-semibold text-npb-text-primary">Getting started</span>
			<span className="-ml-2 rounded-md bg-npb-surface-inset px-2 py-1 font-medium text-npb-accent">Introduction</span>
			<span className={cn(bar, "h-2 w-3/4")} />
			<span className={cn(bar, "h-2 w-1/2")} />
		</div>
	);
}

function PreviewContents(): JSX.Element {
	return (
		<div className="hidden w-28 shrink-0 flex-col gap-2 p-4 text-[10px] sm:flex">
			<span className="font-semibold text-npb-text-secondary">On this page</span>
			<span className={cn(bar, "h-1.5 w-full")} />
			<span className={cn(bar, "h-1.5 w-2/3")} />
			<span className={cn(bar, "h-1.5 w-4/5")} />
		</div>
	);
}

function PreviewNeighbours(): JSX.Element {
	return (
		<div className="mt-auto flex gap-2 pt-4 text-[10px] text-npb-text-muted">
			<span className="flex-1 rounded-md border border-npb-border-strong px-2 py-1.5">Previous</span>
			<span className="flex-1 rounded-md border border-npb-border-strong px-2 py-1.5 text-right">Next</span>
		</div>
	);
}

/**
 * A small stand-in for the docs frame, redrawn as the answers change, so each switch has a visible
 * effect before the docs exist. It is a picture, not the real page: screen readers get one summary.
 */
export function DocsSetupPreview({ name, logoUrl, address, search, sidebar, toc, prevNext, copyPage }: DocsPreviewProps): JSX.Element {
	const shown = name.trim() || "Your docs";
	const has = [search && "search", sidebar && "a sidebar", toc && "an On this page list", prevNext && "previous and next links", copyPage && "a Copy page button"]
		.filter((label): label is string => typeof label === "string")
		.join(", ");
	return (
		<section aria-label="Preview" className="flex min-w-0 flex-col gap-3">
			<h3 className="text-sm font-semibold text-npb-text-secondary">Preview</h3>
			<div
				role="img"
				aria-label={`Preview of ${shown} at ${address}${has ? `, with ${has}` : ""}`}
				className="overflow-hidden rounded-[var(--npb-radius-surface)] border border-npb-border-strong bg-npb-surface-base shadow-[var(--npb-shadow-surface)]"
			>
				<div aria-hidden className="pointer-events-none select-none">
					<div className="flex h-9 items-center gap-2 border-b border-npb-border-default bg-npb-surface-inset px-3">
						<span className="size-2 rounded-full bg-npb-border-strong" />
						<span className="size-2 rounded-full bg-npb-border-strong" />
						<span className="size-2 rounded-full bg-npb-border-strong" />
						<span className="ml-2 flex h-5 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-npb-border-default bg-npb-surface-base px-2 text-[11px] text-npb-text-secondary">
							<Lock className="size-2.5 shrink-0" />
							<span className="truncate">{address}</span>
						</span>
					</div>
					<div className="flex h-10 items-center gap-2.5 border-b border-npb-divider px-4">
						{logoUrl ? (
							<img src={logoUrl} alt="" className="size-5 shrink-0 rounded object-contain" />
						) : (
							<span className="size-5 shrink-0 rounded bg-npb-accent" />
						)}
						<span className={cn("truncate text-xs font-semibold", name.trim() ? "text-npb-text-primary" : "text-npb-text-muted")}>{shown}</span>
						{search ? (
							<span className="ml-3 hidden h-6 w-32 items-center gap-1.5 rounded-md border border-npb-border-strong px-2 text-[11px] text-npb-text-muted sm:flex">
								<Search className="size-2.5" />
								Search the docs
							</span>
						) : null}
						<span className="ml-auto text-[11px] text-npb-text-secondary">GitHub</span>
					</div>
					<div className="flex h-72">
						{sidebar ? <PreviewSidebar /> : null}
						<div className="flex min-w-0 flex-1 flex-col gap-2 p-5">
							<span className="text-[11px] text-npb-text-muted">Getting started</span>
							<div className="flex items-start gap-2">
								<span className="flex-1 text-lg font-bold text-npb-text-primary">Introduction</span>
								{copyPage ? (
									<span className="flex items-center gap-1 rounded-md border border-npb-border-strong px-1.5 py-1 text-[10px] text-npb-text-secondary">
										<Copy className="size-2.5" />
										Copy page
									</span>
								) : null}
							</div>
							<span className="text-xs text-npb-text-secondary">Start writing your first page.</span>
							<span className={cn(bar, "mt-2 h-2 w-full")} />
							<span className={cn(bar, "h-2 w-5/6")} />
							{prevNext ? <PreviewNeighbours /> : null}
						</div>
						{toc ? <PreviewContents /> : null}
					</div>
				</div>
			</div>
		</section>
	);
}
