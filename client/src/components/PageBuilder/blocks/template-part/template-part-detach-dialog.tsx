import type { BlockConfig } from "@shared/schema-types";
import { copyTemplateBlocks } from "@shared/template-parts";
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
import { generateBlockId } from "../../utils";
import { useTemplatePartActions } from "./template-part-actions";

type TemplatePartDetachDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The part on the page that is being detached. */
	blockId: string;
	parentId: string | null;
	templateName: string;
	templateBlocks: BlockConfig[];
};

/**
 * Confirms a detach. The part is replaced by copies of the template's blocks, so the page keeps the
 * look it has now, but those blocks no longer follow the template.
 */
export function TemplatePartDetachDialog({
	open,
	onOpenChange,
	blockId,
	parentId,
	templateName,
	templateBlocks,
}: TemplatePartDetachDialogProps) {
	const partActions = useTemplatePartActions();

	const handleConfirm = () => {
		if (!partActions) return;
		const copies = copyTemplateBlocks({ templateBlocks, parentId, generateId: generateBlockId });
		partActions.replaceBlockWith(blockId, copies);
		onOpenChange(false);
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Detach this template?</AlertDialogTitle>
					<AlertDialogDescription>
						{templateBlocks.length === 0
							? "This template has no blocks yet, so there is nothing to copy onto the page."
							: `The blocks of “${templateName}” stay on this page as normal blocks. Later edits to the template will not reach this page, and you can edit these blocks here.`}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleConfirm} disabled={!partActions || templateBlocks.length === 0}>
						Detach
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
