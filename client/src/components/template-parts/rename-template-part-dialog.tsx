import { useState } from "react";
import { Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import type { LinkedTemplate } from "@/hooks/use-template-parts";
import { apiRequest } from "@/lib/queryClient";

type RenameTemplatePartDialogProps = {
	template: LinkedTemplate;
	onClose: () => void;
};

/** Changes only the name. The blocks, and so every page that shows the template, stay as they are. */
export function RenameTemplatePartDialog({ template, onClose }: RenameTemplatePartDialogProps) {
	const [name, setName] = useState(template.name);
	const trimmed = name.trim();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () => apiRequest("PUT", `/api/templates/${template.id}`, { name: trimmed }),
		onSuccess: () => {
			toast({ title: "Renamed", description: `Renamed to “${trimmed}”.` });
			void queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
			onClose();
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Couldn't rename this template. Try again.",
				variant: "destructive",
			});
		},
	});

	return (
		<Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<DialogContent className="max-w-md">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (trimmed && !mutation.isPending) mutation.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Pencil className="h-4 w-4 text-npb-text-muted" aria-hidden />
							Rename template
						</DialogTitle>
						<DialogDescription>Only the name changes. The blocks stay the same.</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-2">
						<Label htmlFor="rename-template-part">Name</Label>
						<Input
							id="rename-template-part"
							value={name}
							onChange={(event) => setName(event.target.value)}
							autoFocus
						/>
						{trimmed ? null : <p className="text-xs text-npb-text-muted">Give the template a name.</p>}
					</div>

					<DialogFooter className="mt-4">
						<Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
							Cancel
						</Button>
						<Button type="submit" className="npb-btn-accent" disabled={!trimmed || mutation.isPending}>
							{mutation.isPending ? "Saving..." : "Save name"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
