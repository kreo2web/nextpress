import { useState } from "react";
import { LayoutPanelTop } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Template } from "@shared/schema-types";
import { DEFAULT_TEMPLATE_ROOT, type TemplateRootBlockName } from "@shared/template-parts";
import { TEMPLATE_ROOT_OPTIONS, templateEditorPath } from "@/lib/template-parts/template-part-labels";
import { getDefaultBlock } from "@/components/PageBuilder/blocks";

type NewTemplatePartDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	siteId: string | null;
};

/**
 * Creates a linked template for this site, then opens it in the editor. A template is one layout
 * block (picked here, a Group unless chosen otherwise) that can hold anything; on a page it fills
 * one slot like any layout block. The site is sent with the request, so the template can only be
 * created for a site the admin can reach.
 */
export function NewTemplatePartDialog({ open, onOpenChange, siteId }: NewTemplatePartDialogProps) {
	const [name, setName] = useState("");
	const [root, setRoot] = useState<TemplateRootBlockName>(DEFAULT_TEMPLATE_ROOT);
	const [, setLocation] = useLocation();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const trimmed = name.trim();

	const reset = () => {
		setName("");
		setRoot(DEFAULT_TEMPLATE_ROOT);
	};

	const mutation = useMutation({
		mutationFn: async () => {
			const rootBlock = getDefaultBlock(root, crypto.randomUUID());
			const response = await apiRequest("POST", "/api/templates", {
				name: trimmed,
				usage: "part",
				siteId,
				blocks: rootBlock ? [rootBlock] : [],
			});
			return (await response.json()) as Template;
		},
		onSuccess: (template) => {
			void queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
			reset();
			onOpenChange(false);
			setLocation(templateEditorPath(template.id));
		},
		onError: (error: unknown) => {
			toast({
				title: "Couldn't create the template",
				description: error instanceof Error && error.message ? error.message : "Try again in a moment.",
				variant: "destructive",
			});
		},
	});

	const canCreate = Boolean(trimmed) && Boolean(siteId) && !mutation.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-w-md">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (canCreate) mutation.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<LayoutPanelTop className="h-4 w-4 text-npb-text-muted" aria-hidden />
							New template
						</DialogTitle>
						<DialogDescription>
							A template is one layout block you design once. Put anything inside it; every page that shows it updates when you change it.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="new-template-part-name">Name</Label>
							<Input
								id="new-template-part-name"
								placeholder="For example, Main header or Sign-up box"
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="new-template-part-root">Starts as</Label>
							<Select value={root} onValueChange={(value) => setRoot(value as TemplateRootBlockName)}>
								<SelectTrigger id="new-template-part-root" className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TEMPLATE_ROOT_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-npb-text-muted">
								The layout block everything else goes inside: a Group stacks things, Columns sets them side by side.
							</p>
						</div>
						{trimmed ? null : <p className="text-xs text-npb-text-muted">Give the template a name to continue.</p>}
						{siteId ? null : <p className="text-xs text-npb-text-muted">Pick a site first.</p>}
					</div>

					<DialogFooter className="mt-4">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
							Cancel
						</Button>
						<Button type="submit" className="npb-btn-accent" disabled={!canCreate}>
							{mutation.isPending ? "Creating..." : "Create and open"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
