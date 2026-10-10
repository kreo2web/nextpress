import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, ExternalLink, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { RowActionsMenu } from "@/components/admin/content-list";
import { DeleteSiteDialog, SiteFormDialog, type SiteFormValues } from "@/components/sites";
import { apiRequest } from "@/lib/queryClient";
import { useActiveSite, type ActiveSiteItem } from "@/hooks/useActiveSite";
import { useToast } from "@/hooks/use-toast";

type SitesResponse = {
	sites: ActiveSiteItem[];
	total: number;
};

/** Every site write answers with the site and, when the web server needs a word, a plain note. */
type SiteSaveResponse = { site: ActiveSiteItem; notice?: string | null };

type FormState = { mode: "create" } | { mode: "edit"; site: ActiveSiteItem } | null;

const readError = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim() ? error.message : fallback;

/**
 * Admin page for the sites of this install: add one, give it an address, pick the one you work on,
 * make one the default (it answers addresses no other site claims), and delete empty ones.
 */
export default function Sites() {
	const { sites, activeSiteId, setActiveSiteId, formatSiteLabel } = useActiveSite();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<FormState>(null);
	const [deleteTarget, setDeleteTarget] = useState<ActiveSiteItem | null>(null);

	const { isLoading } = useQuery<SitesResponse>({ queryKey: ["/api/sites"] });

	const refreshSites = (): void => {
		queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
		queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
	};

	const showError = (title: string) => (error: unknown) =>
		toast({ title, description: readError(error, "Try again in a moment."), variant: "destructive" });

	const createMutation = useMutation({
		mutationFn: async (values: SiteFormValues) => {
			const response = await apiRequest("POST", "/api/sites", {
				name: values.name.trim(),
				siteUrl: values.siteUrl.trim() || null,
				description: values.description.trim() || null,
			});
			return (await response.json()) as SiteSaveResponse;
		},
		onSuccess: ({ site, notice }) => {
			refreshSites();
			setForm(null);
			// Stay on the current site: jumping to the new, empty one made the old pages look gone.
			toast({
				title: "Site created",
				description: notice || `“${formatSiteLabel(site)}” is ready. Switch to it to add pages.`,
				action: (
					<ToastAction altText={`Switch to ${formatSiteLabel(site)}`} onClick={() => setActiveSiteId(site.id)}>
						Switch to it
					</ToastAction>
				),
			});
		},
		onError: showError("Could not create the site"),
	});

	const updateMutation = useMutation({
		mutationFn: async (params: { id: string; data: Partial<SiteFormValues> & { isDefault?: boolean } }) => {
			const { name, siteUrl, isDefault } = params.data;
			const response = await apiRequest("PATCH", `/api/sites/${params.id}`, {
				...(name !== undefined ? { name: name.trim() } : {}),
				...(siteUrl !== undefined ? { siteUrl: siteUrl.trim() || null } : {}),
				...(isDefault !== undefined ? { isDefault } : {}),
			});
			return (await response.json()) as SiteSaveResponse;
		},
		onSuccess: ({ notice }) => {
			refreshSites();
			setForm(null);
			toast({ title: "Site updated", ...(notice ? { description: notice } : {}) });
		},
		onError: showError("Could not save the site"),
	});

	const deleteMutation = useMutation({
		mutationFn: async (siteId: string) => (await apiRequest("DELETE", `/api/sites/${siteId}`)).json(),
		onSuccess: () => {
			refreshSites();
			setDeleteTarget(null);
			toast({ title: "Site deleted" });
		},
		onError: (error: unknown) => {
			setDeleteTarget(null);
			showError("Could not delete the site")(error);
		},
	});

	const submitForm = (values: SiteFormValues): void => {
		if (form?.mode === "edit") {
			updateMutation.mutate({ id: form.site.id, data: { name: values.name, siteUrl: values.siteUrl } });
			return;
		}
		createMutation.mutate(values);
	};

	const siteActions = (site: ActiveSiteItem) => {
		const isActive = site.id === activeSiteId;
		return [
			{
				key: "switch",
				label: "Work on this site",
				icon: <ArrowRightLeft />,
				onSelect: () => setActiveSiteId(site.id),
				disabled: isActive,
				disabledReason: "You're already working on this site",
			},
			{
				key: "visit",
				label: "Visit site",
				icon: <ExternalLink />,
				onSelect: () => site.siteUrl && window.open(site.siteUrl, "_blank", "noopener"),
				disabled: !site.siteUrl,
				disabledReason: "Give it an address first",
			},
			{
				key: "default",
				label: "Make default",
				icon: <Star />,
				onSelect: () => updateMutation.mutate({ id: site.id, data: { isDefault: true } }),
				disabled: site.isDefault || updateMutation.isPending,
				disabledReason: site.isDefault ? "This is already the default site" : undefined,
			},
			{
				key: "delete",
				label: "Delete",
				icon: <Trash2 />,
				onSelect: () => setDeleteTarget(site),
				destructive: true,
				disabled: site.isDefault,
				disabledReason: "Make another site the default first",
			},
		];
	};

	return (
		<AdminLayout
			title="Sites"
			actions={
				<Button className="npb-btn-accent" onClick={() => setForm({ mode: "create" })}>
					<Plus className="mr-2 h-4 w-4" />
					Add site
				</Button>
			}
		>
			<p className="mb-4 text-sm text-npb-text-muted">
				Each site has its own address, pages, media, settings and theme. Pick the site you are working on at
				the top of the admin. The default site answers any address no other site uses.
			</p>

			<Card className="admin-surface">
				<CardContent className="pt-4">
					{isLoading ? (
						<div role="status" aria-label="Loading sites" className="space-y-3 py-2">
							{[0, 1, 2].map((row) => (
								<Skeleton key={row} className="h-10 w-full" />
							))}
						</div>
					) : (
						<Table className="admin-list-table">
							<TableHeader>
								<TableRow>
									<TableHead>Site</TableHead>
									<TableHead>Address</TableHead>
									<TableHead className="w-28 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sites.map((site) => (
									<TableRow key={site.id} data-state={site.id === activeSiteId ? "selected" : undefined}>
										<TableCell>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium text-npb-text-primary">{formatSiteLabel(site)}</span>
												{site.isDefault ? <Badge variant="secondary">Default</Badge> : null}
												{site.id === activeSiteId ? <Badge variant="outline">Working on</Badge> : null}
											</div>
										</TableCell>
										<TableCell className="text-sm">
											{site.siteUrl ? (
												<a
													href={site.siteUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="text-npb-text-secondary hover:text-npb-accent"
												>
													{site.siteUrl}
												</a>
											) : (
												<span className="text-npb-text-muted">No address yet</span>
											)}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													aria-label={`Edit ${formatSiteLabel(site)}`}
													title="Edit"
													onClick={() => setForm({ mode: "edit", site })}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<RowActionsMenu itemTitle={formatSiteLabel(site)} actions={siteActions(site)} />
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<SiteFormDialog
				open={form !== null}
				onOpenChange={(open) => !open && setForm(null)}
				mode={form?.mode ?? "create"}
				initial={form?.mode === "edit" ? { name: form.site.name ?? "", siteUrl: form.site.siteUrl ?? "" } : undefined}
				isSaving={createMutation.isPending || updateMutation.isPending}
				onSubmit={submitForm}
			/>

			<DeleteSiteDialog
				siteLabel={deleteTarget ? formatSiteLabel(deleteTarget) : null}
				isDeleting={deleteMutation.isPending}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
				onCancel={() => setDeleteTarget(null)}
			/>
		</AdminLayout>
	);
}
