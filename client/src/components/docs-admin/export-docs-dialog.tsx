import { useState, type JSX } from "react";
import { Download, Loader2 } from "lucide-react";
import type { DocsSummary } from "@shared/docs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadDocsFile } from "@/lib/docs/docs-api";
import { showSuccessToast } from "@/lib/sonner-toast";

type ExportDocsDialogProps = { docs: DocsSummary; onClose: () => void };

const FALLBACK_FAILURE = "We couldn't prepare the file. Please try again.";

/** The name the file gets if the server doesn't send one. */
const fallbackFileName = (docs: DocsSummary): string => `${docs.path.replace(/^\/+/, "") || "docs"}-docs.nextpress-page.json`;

/**
 * Downloads a whole docs as one file that another NextPress site can import from Pages, with its
 * pages in the same order. The switch leaves images and other files out for a small file.
 */
export function ExportDocsDialog({ docs, onClose }: ExportDocsDialogProps): JSX.Element {
	const [includeFiles, setIncludeFiles] = useState(true);
	const [working, setWorking] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	const download = async (): Promise<void> => {
		setWorking(true);
		setFailure(null);
		try {
			await downloadDocsFile({ homeId: docs.homeId, includeFiles, fallbackName: fallbackFileName(docs) });
			showSuccessToast("Docs file downloaded");
			onClose();
		} catch (caught) {
			const error = caught instanceof Error ? caught : new Error(String(caught));
			console.error({
				atFunction: "ExportDocsDialog.download",
				data: { homeId: docs.homeId, siteId: docs.siteId, includeFiles, error },
				message: "Exporting docs failed",
			});
			const fromServer = typeof (error as Error & { status?: number }).status === "number" && error.message.trim();
			setFailure(fromServer || FALLBACK_FAILURE);
			setWorking(false);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && !working && onClose()}>
			<DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-0 p-0" showCloseButton={!working}>
				<DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
					<span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary">
						<Download className="size-4" />
					</span>
					<DialogTitle className="text-base">Export docs</DialogTitle>
					<DialogDescription className="sr-only">Download {docs.name} as one file.</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-5">
					<p className="text-sm text-npb-text-secondary">
						<span className="font-medium text-npb-text-primary">{docs.name}</span> is saved as one file with all its pages, in the same order. Import it on any NextPress site from Pages.
					</p>
					<div className="flex items-start justify-between gap-4 border-t border-npb-divider pt-4">
						<div className="grid gap-1">
							<Label htmlFor="export-docs-files">Include images and files</Label>
							<p id="export-docs-files-hint" className="text-xs text-npb-text-muted">
								{includeFiles
									? "The docs arrive complete. Larger file."
									: "Small file. Each image or file becomes a named placeholder to swap later."}
							</p>
						</div>
						<Switch
							id="export-docs-files"
							checked={includeFiles}
							onCheckedChange={setIncludeFiles}
							disabled={working}
							aria-describedby="export-docs-files-hint"
						/>
					</div>
					{failure ? (
						<p role="alert" className="text-sm text-npb-status-error">
							{failure}
						</p>
					) : null}
				</div>

				<DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
					<Button type="button" variant="outline" onClick={onClose} disabled={working}>
						Cancel
					</Button>
					<Button type="button" onClick={() => void download()} disabled={working}>
						{working ? <Loader2 aria-hidden className="animate-spin" /> : null}
						{working ? "Preparing file…" : "Download file"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
