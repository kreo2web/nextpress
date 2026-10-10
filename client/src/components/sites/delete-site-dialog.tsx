import type { JSX } from "react";
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

type DeleteSiteDialogProps = {
	siteLabel: string | null;
	isDeleting: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

/** Confirms deleting a site. Open while `siteLabel` is set. */
export function DeleteSiteDialog({ siteLabel, isDeleting, onConfirm, onCancel }: DeleteSiteDialogProps): JSX.Element {
	return (
		<AlertDialog
			open={siteLabel !== null}
			onOpenChange={(open) => {
				if (!open && !isDeleting) onCancel();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{siteLabel ? `Delete “${siteLabel}”?` : "Delete this site?"}</AlertDialogTitle>
					<AlertDialogDescription>
						The site and its settings are removed and its address stops working. A site that still has pages,
						blogs or media can't be deleted: move or delete them first. You can't undo this.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={isDeleting}
						className="bg-red-600 hover:bg-red-700"
						onClick={(event) => {
							event.preventDefault();
							onConfirm();
						}}
					>
						{isDeleting ? "Deleting…" : "Delete site"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
