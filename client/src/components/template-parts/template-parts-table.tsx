import { useState } from "react";
import { Layout, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LinkedTemplate } from "@/hooks/use-template-parts";
import { templateRootLabel, usedOnPagesLabel } from "@/lib/template-parts/template-part-labels";
import { DeleteTemplatePartDialog } from "./delete-template-part-dialog";
import { RenameTemplatePartDialog } from "./rename-template-part-dialog";

type TemplatePartsTableProps = {
	templates: LinkedTemplate[];
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	onEdit: (templateId: string) => void;
	onCreate: () => void;
};

/**
 * The linked templates of the site: name, type, how many pages show each one, and the row actions.
 * Loading, empty and failed states each say one plain thing and offer one way forward.
 */
export function TemplatePartsTable({
	templates,
	isPending,
	isError,
	onRetry,
	onEdit,
	onCreate,
}: TemplatePartsTableProps) {
	const [renameTarget, setRenameTarget] = useState<LinkedTemplate | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<LinkedTemplate | null>(null);

	if (isPending) {
		return (
			<div className="space-y-3 p-4" aria-label="Loading templates">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 py-10 text-center">
				<p className="text-sm text-npb-text-secondary">Templates could not be loaded.</p>
				<Button variant="outline" size="sm" onClick={onRetry}>
					Try again
				</Button>
			</div>
		);
	}

	if (templates.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-10 text-center">
				<p className="text-sm text-npb-text-secondary">Build a block once (a header, a footer, a sign-up box, anything) and use it on every page.</p>
				<Button className="npb-btn-accent" onClick={onCreate}>
					<Layout className="mr-2 h-4 w-4" aria-hidden />
					New template
				</Button>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Layout block</TableHead>
						<TableHead>Used on</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{templates.map((template) => {
						const usedOn = template.usedOnPages ?? 0;
						return (
							<TableRow key={template.id}>
								<TableCell>
									<span className="font-medium text-npb-text-primary">{template.name}</span>
								</TableCell>
								<TableCell>
									<Badge variant="secondary">{templateRootLabel(template.blocks)}</Badge>
								</TableCell>
								<TableCell>
									<span className={usedOn === 0 ? "text-sm text-npb-text-muted" : "text-sm text-npb-text-primary"}>
										{usedOnPagesLabel(usedOn)}
									</span>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-1">
										<Button variant="ghost" size="sm" onClick={() => onEdit(template.id)}>
											<Layout className="mr-1.5 h-4 w-4" aria-hidden />
											Edit
										</Button>
										<Button
											variant="ghost"
											size="sm"
											aria-label={`Rename ${template.name}`}
											title="Rename"
											onClick={() => setRenameTarget(template)}
										>
											<Pencil className="h-4 w-4" aria-hidden />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											aria-label={`Delete ${template.name}`}
											title="Delete"
											onClick={() => setDeleteTarget(template)}
										>
											<Trash2 className="h-4 w-4" aria-hidden />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			{renameTarget ? (
				<RenameTemplatePartDialog
					key={renameTarget.id}
					template={renameTarget}
					onClose={() => setRenameTarget(null)}
				/>
			) : null}
			{deleteTarget ? (
				<DeleteTemplatePartDialog
					key={deleteTarget.id}
					template={deleteTarget}
					onClose={() => setDeleteTarget(null)}
				/>
			) : null}
		</>
	);
}
