import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminLayout } from "@/components/AdminLayout";
import { TemplatePartsTable } from "@/components/template-parts/template-parts-table";
import { NewTemplatePartDialog } from "@/components/template-parts/new-template-part-dialog";
import { useActiveSite } from "@/hooks/useActiveSite";
import { useLinkedTemplates } from "@/hooks/use-template-parts";
import { templateEditorPath } from "@/lib/template-parts/template-part-labels";

/**
 * Templates: the linked templates of the active site. A template is built once and shown on many
 * pages through a template block, so an edit here reaches every page that uses it.
 * Pre-designed blocks, which are copied into a page, live on their own page.
 */
export default function Templates() {
	const { activeSiteId, isLoading: siteLoading } = useActiveSite();
	const [, setLocation] = useLocation();
	const [createOpen, setCreateOpen] = useState(false);
	const siteId = activeSiteId || null;
	const list = useLinkedTemplates({ siteId });

	return (
		<AdminLayout
			title="Templates"
			actions={
				<Button className="npb-btn-accent" onClick={() => setCreateOpen(true)} disabled={!siteId}>
					<Plus className="mr-2 h-4 w-4" aria-hidden />
					New template
				</Button>
			}
		>
			{!siteLoading && !siteId ? (
				<p className="text-sm text-npb-text-muted">Pick a site to see its templates.</p>
			) : (
				<Card className="admin-surface">
					<CardContent className="p-0">
						<TemplatePartsTable
							templates={list.data?.templates ?? []}
							isPending={siteLoading || (Boolean(siteId) && list.isPending)}
							isError={list.isError}
							onRetry={() => void list.refetch()}
							onEdit={(templateId) => setLocation(templateEditorPath(templateId))}
							onCreate={() => setCreateOpen(true)}
						/>
					</CardContent>
				</Card>
			)}

			<NewTemplatePartDialog open={createOpen} onOpenChange={setCreateOpen} siteId={siteId} />
		</AdminLayout>
	);
}
