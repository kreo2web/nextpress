import { useMemo, useState, type FormEvent, type JSX } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocsTree, useSiteDocs } from "@/hooks/use-site-docs";
import { DOCS_QUERY_KEY, addDocsPage, docsPageEditorPath } from "@/lib/docs/docs-api";
import { showSuccessToast } from "@/lib/sonner-toast";
import { buildPutUnderOptions, indentOptionLabel } from "./docs-tree-options";

type NewDocsPageDialogProps = {
	siteId: string;
	/** Skips "which docs": the Docs screen opens this for the docs a person is looking at. */
	homeId?: string;
	onClose: () => void;
	/** "Set up new docs": the way out when the site has no docs, and the way to another docs when it has some. */
	onSetupDocs?: () => void;
};

type FormError = { field: "title" | "form"; message: string };

const FALLBACK_FAILURE = "We couldn't add the page. Check your connection and try again.";

const fullWidth = "[&_[data-slot=native-select-wrapper]]:w-full";

/**
 * A new page in docs that already exist: a title and where it goes in the sidebar, then the editor
 * opens on it. The page starts empty; everything else is set in the editor.
 */
export function NewDocsPageDialog({ siteId, homeId, onClose, onSetupDocs }: NewDocsPageDialogProps): JSX.Element {
	const [, setLocation] = useLocation();
	const queryClient = useQueryClient();
	const docsQuery = useSiteDocs({ siteId });
	const docs = docsQuery.data ?? [];

	const [pickedHomeId, setPickedHomeId] = useState("");
	const [pickedParentId, setPickedParentId] = useState("");
	const [title, setTitle] = useState("");
	const [error, setError] = useState<FormError | null>(null);
	const [saving, setSaving] = useState(false);

	const selectedHomeId = homeId ?? (docs.some((entry) => entry.homeId === pickedHomeId) ? pickedHomeId : (docs[0]?.homeId ?? ""));
	const treeQuery = useDocsTree({ homeId: selectedHomeId });
	const options = useMemo(() => (treeQuery.data ? buildPutUnderOptions({ tree: treeQuery.data }) : []), [treeQuery.data]);
	const parentId = options.some((option) => option.value === pickedParentId) ? pickedParentId : selectedHomeId;

	const failed = docsQuery.isError || treeQuery.isError;
	const ready = !docsQuery.isLoading && !treeQuery.isLoading && !failed && selectedHomeId !== "";

	const create = async (): Promise<void> => {
		const typed = title.trim();
		if (!typed) {
			setError({ field: "title", message: "Give the page a title." });
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const item = await addDocsPage({ homeId: selectedHomeId, parentId, title: typed });
			void queryClient.invalidateQueries({ queryKey: [DOCS_QUERY_KEY] });
			void queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
			showSuccessToast("Docs page created");
			setLocation(docsPageEditorPath(item.id));
			onClose();
		} catch (caught) {
			const failure = caught instanceof Error ? caught : new Error(String(caught));
			console.error({
				atFunction: "NewDocsPageDialog.create",
				data: { siteId, homeId: selectedHomeId, parentId, error: failure },
				message: "Adding a docs page failed",
			});
			const fromServer = typeof (failure as Error & { status?: number }).status === "number" && failure.message.trim();
			setError({ field: "form", message: fromServer || FALLBACK_FAILURE });
			setSaving(false);
		}
	};

	const submit = (event: FormEvent): void => {
		event.preventDefault();
		if (!saving && ready) void create();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
			<DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 p-0" showCloseButton={!saving}>
				<form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" aria-busy={saving || undefined}>
					<DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
						<span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary">
							<BookOpen className="size-4" />
						</span>
						<DialogTitle className="text-base">New docs page</DialogTitle>
						<DialogDescription className="sr-only">Give the page a title and choose where it goes in your docs.</DialogDescription>
					</DialogHeader>

					<div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
						{docsQuery.isLoading || (selectedHomeId !== "" && treeQuery.isLoading) ? (
							<div role="status" aria-label="Loading your docs" className="grid gap-4">
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
							</div>
						) : null}

						{failed ? (
							<p role="alert" className="text-sm text-npb-text-secondary">
								We couldn't load your docs.{" "}
								<Button type="button" variant="link" className="h-auto p-0" onClick={() => void (docsQuery.isError ? docsQuery.refetch() : treeQuery.refetch())}>
									Try again
								</Button>
							</p>
						) : null}

						{!docsQuery.isLoading && !docsQuery.isError && docs.length === 0 ? (
							<p className="text-sm text-npb-text-secondary">
								This site has no docs yet.{" "}
								{onSetupDocs ? (
									<Button type="button" variant="link" className="h-auto p-0" onClick={onSetupDocs}>
										Set up docs
									</Button>
								) : null}
							</p>
						) : null}

						{ready ? (
							<>
								<div className="grid gap-2">
									<Label htmlFor="new-docs-page-title">Title</Label>
									<Input
										id="new-docs-page-title"
										autoFocus
										autoComplete="off"
										placeholder="Install"
										value={title}
										disabled={saving}
										aria-invalid={error?.field === "title" ? true : undefined}
										aria-describedby={error?.field === "title" ? "new-docs-page-title-error" : undefined}
										onChange={(event) => {
											setTitle(event.target.value);
											if (error?.field === "title") setError(null);
										}}
									/>
									{error?.field === "title" ? (
										<p id="new-docs-page-title-error" role="alert" className="text-sm text-npb-status-error">
											{error.message}
										</p>
									) : null}
								</div>

								{docs.length > 1 && !homeId ? (
									<div className={`grid gap-2 ${fullWidth}`}>
										<Label htmlFor="new-docs-page-docs">Docs</Label>
										<NativeSelect
											id="new-docs-page-docs"
											value={selectedHomeId}
											disabled={saving}
											onChange={(event) => {
												setPickedHomeId(event.target.value);
												setPickedParentId("");
											}}
										>
											{docs.map((entry) => (
												<NativeSelectOption key={entry.homeId} value={entry.homeId}>
													{entry.name}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</div>
								) : null}

								<div className={`grid gap-2 ${fullWidth}`}>
									<Label htmlFor="new-docs-page-under">Put it under</Label>
									<NativeSelect id="new-docs-page-under" value={parentId} disabled={saving} onChange={(event) => setPickedParentId(event.target.value)}>
										{options.map((option) => (
											<NativeSelectOption key={option.value} value={option.value}>
												{indentOptionLabel(option)}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</div>
							</>
						) : null}

						{error?.field === "form" ? (
							<p role="alert" className="text-sm text-npb-status-error">
								{error.message}
							</p>
						) : null}
					</div>

					<DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
						{onSetupDocs && docs.length > 0 ? (
							<Button type="button" variant="link" className="mr-auto h-auto px-0" onClick={onSetupDocs} disabled={saving}>
								Set up new docs
							</Button>
						) : null}
						<Button type="button" variant="outline" onClick={onClose} disabled={saving}>
							Cancel
						</Button>
						<Button type="submit" disabled={!ready || saving}>
							{saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
							{saving ? "Creating…" : "Create page"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
