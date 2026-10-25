import type { JSX } from "react";
import { Link } from "wouter";
import { Download, ExternalLink, Globe, Plus } from "lucide-react";
import type { DocsSummary } from "@shared/docs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocsTree } from "@/hooks/use-site-docs";
import type { ActiveSiteItem } from "@/hooks/useActiveSite";
import { docsPageEditorPath } from "@/lib/docs/docs-api";
import { formatContentStatus } from "@/lib/format-content-status";
import { describeDocsAddress } from "./docs-address-display";
import { DocsTreeView } from "./docs-tree-view";

type DocsCardProps = {
	docs: DocsSummary;
	/** The site the docs live on, to work out their address. */
	site: ActiveSiteItem | undefined;
	homepageSlug: string | undefined;
	onNewPage: () => void;
	onExport: () => void;
};

function DocsPages({ docs }: { docs: DocsSummary }): JSX.Element | null {
	const tree = useDocsTree({ homeId: docs.homeId });
	if (tree.isLoading) {
		return (
			<div role="status" aria-label="Loading pages" className="grid gap-2">
				<Skeleton className="h-5 w-1/2" />
				<Skeleton className="h-5 w-2/3" />
				<Skeleton className="h-5 w-1/3" />
			</div>
		);
	}
	if (tree.isError || !tree.data) {
		return (
			<p role="alert" className="text-sm text-npb-text-secondary">
				We couldn't load the pages.{" "}
				<Button type="button" variant="link" className="h-auto p-0" onClick={() => void tree.refetch()}>
					Try again
				</Button>
			</p>
		);
	}
	return (
		<div role="region" aria-label={`Pages of ${docs.name}`} tabIndex={0} className="max-h-80 overflow-y-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus">
			<DocsTreeView tree={tree.data} />
		</div>
	);
}

/**
 * One docs on the Docs screen: what it is called, where it lives, whether search is on, how many
 * pages it has and whether it is published, the three things you do with it, and its pages.
 */
export function DocsCard({ docs, site, homepageSlug, onNewPage, onExport }: DocsCardProps): JSX.Element {
	const address = describeDocsAddress({ site, path: docs.path, homepageSlug, status: docs.status });
	const headingId = `docs-${docs.homeId}-name`;
	const published = docs.status === "publish";

	return (
		<Card role="region" aria-labelledby={headingId} className="admin-surface gap-0 divide-y divide-npb-divider py-0">
			<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 p-5">
				<div className="grid min-w-0 gap-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<h2 id={headingId} className="min-w-0 truncate text-lg font-semibold text-npb-text-primary">
							{docs.name}
						</h2>
						<Badge variant={published ? "secondary" : "outline"}>{formatContentStatus(docs.status)}</Badge>
					</div>
					<p className="flex min-w-0 items-center gap-1.5 text-sm text-npb-text-secondary">
						<Globe aria-hidden className="size-3.5 shrink-0" />
						{address.href ? (
							<a
								href={address.href}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:text-npb-accent hover:underline"
							>
								<span className="truncate">{address.text}</span>
								<ExternalLink aria-hidden className="size-3 shrink-0" />
								<span className="sr-only">(opens the live docs in a new tab)</span>
							</a>
						) : (
							<span className="truncate">{address.text}</span>
						)}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button asChild>
						<Link href={docsPageEditorPath(docs.homeId)} aria-label={`Open editor for ${docs.name}`}>
							Open editor
						</Link>
					</Button>
					<Button type="button" variant="outline" onClick={onNewPage} aria-label={`New docs page for ${docs.name}`}>
						<Plus aria-hidden />
						New docs page
					</Button>
					<Button type="button" variant="outline" onClick={onExport} aria-label={`Export docs for ${docs.name}`}>
						<Download aria-hidden />
						Export docs
					</Button>
				</div>
			</div>

			<dl className="flex flex-wrap gap-x-8 gap-y-1 px-5 py-3 text-sm">
				<div className="flex gap-2">
					<dt className="text-npb-text-muted">Search</dt>
					<dd className="font-medium text-npb-text-primary">{docs.searchOn ? "On" : "Off"}</dd>
				</div>
				<div className="flex gap-2">
					<dt className="text-npb-text-muted">Pages</dt>
					<dd className="font-medium tabular-nums text-npb-text-primary">{docs.pageCount}</dd>
				</div>
			</dl>

			<div className="grid gap-2 px-5 py-4">
				<h3 className="text-sm font-semibold text-npb-text-secondary">Pages, in sidebar order</h3>
				<DocsPages docs={docs} />
			</div>
		</Card>
	);
}
