import type { ReactElement } from "react";
import type { DocsTreeItem } from "@shared/docs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { navDescendants } from "./docs-nav-model";

type Props = {
	item: DocsTreeItem | null;
	onCancel: () => void;
	onConfirm: (item: DocsTreeItem) => void;
};

/**
 * "Delete…" asks first. A page with pages under it can't be deleted, so the dialog says that
 * and offers no delete button, instead of letting the server refuse a button that looked fine.
 */
export function DocsDeleteDialog({ item, onCancel, onConfirm }: Props): ReactElement {
	const below = item ? navDescendants(item).length : 0;
	const noun = item?.kind === "group" ? "group" : "page";
	return (
		<AlertDialog open={item !== null} onOpenChange={(open) => !open && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{item ? `Delete “${item.title}”?` : "Delete?"}</AlertDialogTitle>
					<AlertDialogDescription>
						{below > 0
							? `This ${noun} has ${below} ${below === 1 ? "page" : "pages"} under it. Move or delete ${below === 1 ? "it" : "them"} first, then delete this ${noun}.`
							: `The ${noun} is deleted and its address stops working.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{below > 0 ? "Close" : "Keep it"}</AlertDialogCancel>
					{below === 0 && item ? <AlertDialogAction onClick={() => onConfirm(item)}>{`Delete ${noun}`}</AlertDialogAction> : null}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
