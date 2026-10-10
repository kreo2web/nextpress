import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTemplateUsage, type LinkedTemplate } from "@/hooks/use-template-parts";
import { apiRequest } from "@/lib/queryClient";

type DeleteTemplatePartDialogProps = {
	template: LinkedTemplate;
	onClose: () => void;
};

const SHOWN_PAGE_LIMIT = 5;

/**
 * Confirms a delete. The pages that show the template are counted first, so the owner knows which
 * pages will lose the part. Delete stays off until that count is known.
 */
export function DeleteTemplatePartDialog({ template, onClose }: DeleteTemplatePartDialogProps) {
	const usage = useTemplateUsage({ templateId: template.id });
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const pages = usage.data?.pages ?? [];
	const pageCount = pages.length;
	const usageReady = usage.isSuccess;

	const mutation = useMutation({
		mutationFn: () => apiRequest("DELETE", `/api/templates/${template.id}`),
		onSuccess: () => {
			toast({ title: "Deleted", description: "The template was deleted." });
			void queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
			onClose();
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Couldn't delete this template. Try again.",
				variant: "destructive",
			});
		},
	});

	const usageText = (() => {
		if (usage.isPending) return "Checking which pages use this template...";
		if (usage.isError) return "Couldn't check which pages use this template, so it can't be deleted yet. Try again.";
		if (pageCount === 0) return "No page uses this template. You cannot undo this.";
		const pageWord = pageCount === 1 ? "page" : "pages";
		const losing = pageCount === 1 ? "That page" : "Those pages";
		return `This template is used on ${pageCount} ${pageWord}. ${losing} will lose this part and show nothing in its place. You cannot undo this.`;
	})();

	return (
		<AlertDialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete “{template.name}”?</AlertDialogTitle>
					<AlertDialogDescription>{usageText}</AlertDialogDescription>
				</AlertDialogHeader>

				{usageReady && pageCount > 0 ? (
					<ul className="space-y-1 text-sm text-npb-text-secondary">
						{pages.slice(0, SHOWN_PAGE_LIMIT).map((page) => (
							<li key={page.id}>{page.title || "Untitled page"}</li>
						))}
						{pageCount > SHOWN_PAGE_LIMIT ? <li>and {pageCount - SHOWN_PAGE_LIMIT} more</li> : null}
					</ul>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(event) => {
							event.preventDefault();
							mutation.mutate();
						}}
						disabled={!usageReady || mutation.isPending}
						className="bg-red-600 hover:bg-red-700"
					>
						{mutation.isPending ? "Deleting..." : "Delete template"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
