import { useState, type JSX } from "react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NewKindCards, type NewKind } from "./new-kind-cards";

/** What the site's docs look like from here: setup is only offered when there are none. */
export type DocsChoice = { status: "loading" } | { status: "error" } | { status: "none" } | { status: "some" };

type NewChooserDialogProps = {
	docs: DocsChoice;
	onPick: (kind: NewKind) => void;
	onRetryDocs: () => void;
	onClose: () => void;
};

const DOCS_HINT: Record<"none" | "some", string> = {
	none: "This site has no docs yet. Next you pick a name, where the docs live and what they have. After that, new docs pages only ask for a title.",
	some: "Next: a title, and where the page goes in your docs sidebar.",
};

function DocsHint({ docs, onRetry }: { docs: DocsChoice; onRetry: () => void }): JSX.Element {
	return (
		<div className="flex gap-3 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-3.5 text-sm leading-relaxed text-npb-text-secondary">
			{docs.status === "loading" ? <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" /> : <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0" />}
			{docs.status === "loading" ? <p role="status">Checking your docs…</p> : null}
			{docs.status === "error" ? (
				<p role="alert">
					We couldn't check your docs.{" "}
					<Button type="button" variant="link" className="h-auto p-0" onClick={onRetry}>
						Try again
					</Button>
				</p>
			) : null}
			{docs.status === "none" || docs.status === "some" ? <p>{DOCS_HINT[docs.status]}</p> : null}
		</div>
	);
}

/**
 * "What are you making?": a page, a blog post or a docs page. It only picks; each choice goes to
 * its own step. Docs need setting up once, so on a site without docs that card says so first.
 */
export function NewChooserDialog({ docs, onPick, onRetryDocs, onClose }: NewChooserDialogProps): JSX.Element {
	const [kind, setKind] = useState<NewKind>("page");
	const waitingForDocs = kind === "docs" && (docs.status === "loading" || docs.status === "error");
	const continueLabel = kind === "docs" && docs.status === "none" ? "Set up docs" : "Continue";

	const confirm = (): void => {
		if (!waitingForDocs) onPick(kind);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 p-0">
				<DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
					<span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary">
						<Plus className="size-4" />
					</span>
					<DialogTitle className="text-base">What are you making?</DialogTitle>
					<DialogDescription className="sr-only">Pick a page, a blog post or a docs page.</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5">
					<NewKindCards value={kind} onValueChange={setKind} onConfirm={confirm} />
					{kind === "docs" ? <DocsHint docs={docs} onRetry={onRetryDocs} /> : null}
				</div>

				<DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" onClick={confirm} disabled={waitingForDocs}>
						{continueLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
