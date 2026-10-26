import { useState, type JSX } from "react";
import { BookOpen, Plus } from "lucide-react";
import type { DocsSummary } from "@shared/docs";
import { AdminLayout } from "@/components/AdminLayout";
import { DocsCard, ExportDocsDialog, useHomepageSlug } from "@/components/docs-admin";
import { DocsSetupModal, NewContentButton, NewDocsPageDialog } from "@/components/new-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteDocs } from "@/hooks/use-site-docs";
import { useActiveSite } from "@/hooks/useActiveSite";

/**
 * The docs of the site you are working on. Keyed by site so switching sites starts the screen clean.
 */
export default function Docs(): JSX.Element {
	const { activeSiteId } = useActiveSite();
	return <DocsScreen key={activeSiteId || "no-active-site"} siteId={activeSiteId} />;
}

function DocsLoading(): JSX.Element {
	return (
		<div role="status" aria-label="Loading docs">
			<Card className="admin-surface gap-0 py-0">
				<div className="grid gap-3 p-5">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<div className="grid gap-2 border-t border-npb-divider p-5">
					<Skeleton className="h-4 w-1/2" />
					<Skeleton className="h-4 w-2/3" />
				</div>
			</Card>
		</div>
	);
}

function DocsScreen({ siteId }: { siteId: string }): JSX.Element {
	const { activeSite } = useActiveSite();
	const docsQuery = useSiteDocs({ siteId });
	const homepageSlug = useHomepageSlug({ siteId });
	const [settingUp, setSettingUp] = useState(false);
	const [addingTo, setAddingTo] = useState<DocsSummary | null>(null);
	const [exporting, setExporting] = useState<DocsSummary | null>(null);
	const docs = docsQuery.data ?? [];

	return (
		<AdminLayout
			title="Docs"
			actions={
				<div className="flex items-center gap-2">
					{/* With no docs yet the empty card below offers it, so it is said once. */}
					{docs.length > 0 ? (
						<Button type="button" variant="outline" onClick={() => setSettingUp(true)}>
							<Plus aria-hidden /> Set up docs
						</Button>
					) : null}
					<NewContentButton variant="header" />
				</div>
			}
		>
			{docsQuery.isLoading || siteId === "" ? <DocsLoading /> : null}

			{docsQuery.isError && !docsQuery.data ? (
				<Card className="admin-surface">
					<CardContent role="alert" className="py-6 text-center text-sm text-npb-text-secondary">
						We couldn't load your docs.{" "}
						<Button type="button" variant="link" className="h-auto p-0" onClick={() => void docsQuery.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			) : null}

			{docsQuery.data && docs.length === 0 ? (
				<Card className="admin-surface">
					<CardContent>
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<BookOpen aria-hidden />
								</EmptyMedia>
								<EmptyDescription>No docs on this site yet.</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button type="button" onClick={() => setSettingUp(true)}>
									Set up docs
								</Button>
							</EmptyContent>
						</Empty>
					</CardContent>
				</Card>
			) : null}

			{docs.length > 0 ? (
				<div className="grid gap-6">
					{docs.map((entry) => (
						<DocsCard
							key={entry.homeId}
							docs={entry}
							site={activeSite}
							homepageSlug={homepageSlug}
							onNewPage={() => setAddingTo(entry)}
							onExport={() => setExporting(entry)}
						/>
					))}
				</div>
			) : null}

			{settingUp ? <DocsSetupModal onClose={() => setSettingUp(false)} /> : null}
			{addingTo ? <NewDocsPageDialog siteId={siteId} homeId={addingTo.homeId} onClose={() => setAddingTo(null)} /> : null}
			{exporting ? <ExportDocsDialog docs={exporting} onClose={() => setExporting(null)} /> : null}
		</AdminLayout>
	);
}
